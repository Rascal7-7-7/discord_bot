import https from 'https';

export interface FeedItem {
  title: string;
  link: string;
  summary: string;
  source: string;
  publishedAt: Date;
}

/** Node.js 組み込み https で JSON 取得 */
function httpsGetJson(urlStr: string, redirects = 0): Promise<unknown> {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const req = https.get(urlStr, {
      headers: {
        'User-Agent': 'PulseBot/1.0 (Discord trend bot)',
        'Accept': 'application/json',
      },
      timeout: 20000,
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        req.destroy();
        httpsGetJson(res.headers.location, redirects + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => {
        try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf-8'))); }
        catch (e) { reject(e); }
      });
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout (20s)')); });
  });
}

/** Node.js 組み込み https でテキスト（RSS XML等）取得 */
function httpsGetText(urlStr: string, redirects = 0): Promise<string> {
  if (redirects > 5) return Promise.reject(new Error('Too many redirects'));
  return new Promise((resolve, reject) => {
    const req = https.get(urlStr, {
      headers: {
        'User-Agent': 'PulseBot/1.0 (Discord trend bot)',
        'Accept': 'application/rss+xml, application/xml, text/xml, */*',
      },
      timeout: 20000,
    }, (res) => {
      if ((res.statusCode === 301 || res.statusCode === 302) && res.headers.location) {
        req.destroy();
        httpsGetText(res.headers.location, redirects + 1).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`HTTP ${res.statusCode}`));
        return;
      }
      const chunks: Buffer[] = [];
      res.on('data', (chunk: Buffer) => chunks.push(chunk));
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
      res.on('error', reject);
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('Timeout (20s)')); });
  });
}

/** RSS XML の <item> から指定タグのテキストを取得する */
function extractXmlTag(item: string, tag: string): string {
  const re = new RegExp(
    `<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`,
    'i'
  );
  return (item.match(re)?.[1] ?? '').trim();
}

/** RSS XML の <link> を取得する（RSS 2.0 / Atom 両対応） */
function extractXmlLink(item: string): string {
  // RSS 2.0: <link>https://...</link>
  const rssLink = extractXmlTag(item, 'link');
  if (rssLink.startsWith('http')) return rssLink;
  // Atom: <link href="https://..."/>
  const atomHref = item.match(/<link[^>]+href=["'](https?:\/\/[^"']+)["'][^>]*\/?>/i)?.[1] ?? '';
  return atomHref;
}

/** RSS XML 文字列から FeedItem[] を生成する */
function parseRssFeed(xml: string, source: string, limit = 10): FeedItem[] {
  const itemRegex = /<item[\s>][\s\S]*?<\/item>/g;
  const items: FeedItem[] = [];
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xml)) !== null && items.length < limit) {
    const item = match[0];
    const title = extractXmlTag(item, 'title');
    const link = extractXmlLink(item);
    const description = extractXmlTag(item, 'description')
      .replace(/<[^>]+>/g, '')
      .slice(0, 200);
    const pubDate = extractXmlTag(item, 'pubDate') || extractXmlTag(item, 'published');

    if (!title || !link.startsWith('http')) continue;

    items.push({
      title,
      link,
      summary: description,
      source,
      publishedAt: pubDate ? new Date(pubDate) : new Date(),
    });
  }

  return items;
}

// ── Hacker News ────────────────────────────────────────────
async function fetchHackerNews(): Promise<FeedItem[]> {
  const ids = await httpsGetJson(
    'https://hacker-news.firebaseio.com/v0/topstories.json'
  ) as number[];

  const items = await Promise.allSettled(
    ids.slice(0, 15).map((id) =>
      httpsGetJson(`https://hacker-news.firebaseio.com/v0/item/${id}.json`)
    )
  );

  const results: FeedItem[] = [];
  for (const r of items) {
    if (r.status !== 'fulfilled') continue;
    const item = r.value as { title?: string; url?: string; time?: number; score?: number; type?: string };
    if (item.type !== 'story' || !item.url) continue;
    results.push({
      title:       item.title ?? '',
      link:        item.url,
      summary:     `HN score: ${item.score ?? 0}`,
      source:      'Hacker News',
      publishedAt: item.time ? new Date(item.time * 1000) : new Date(),
    });
  }
  return results;
}

// ── Dev.to ─────────────────────────────────────────────────
async function fetchDevTo(): Promise<FeedItem[]> {
  const articles = await httpsGetJson(
    'https://dev.to/api/articles?top=1&per_page=10'
  ) as { title?: string; url?: string; description?: string; published_at?: string }[];

  return articles.map((a) => ({
    title:       a.title ?? '',
    link:        a.url ?? '',
    summary:     a.description ?? '',
    source:      'Dev.to',
    publishedAt: a.published_at ? new Date(a.published_at) : new Date(),
  }));
}

// ── Lobste.rs ──────────────────────────────────────────────
async function fetchLobsters(): Promise<FeedItem[]> {
  const items = await httpsGetJson('https://lobste.rs/hottest.json') as {
    title?: string;
    url?: string;
    description_plain?: string;
    created_at?: string;
    score?: number;
    tags?: string[];
  }[];

  return items.slice(0, 10).flatMap((item) => {
    if (!item.url) return [];
    return [{
      title:       item.title ?? '',
      link:        item.url,
      summary:     item.description_plain || `Lobste.rs score: ${item.score ?? 0} | tags: ${(item.tags ?? []).join(', ')}`,
      source:      'Lobste.rs',
      publishedAt: item.created_at ? new Date(item.created_at) : new Date(),
    }];
  });
}

// ── GitHub Trending (AI/LLM) ───────────────────────────────
async function fetchGitHubTrending(): Promise<FeedItem[]> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    .toISOString().slice(0, 10); // YYYY-MM-DD

  const data = await httpsGetJson(
    `https://api.github.com/search/repositories?q=topic:llm+topic:ai+created:%3E${since}&sort=stars&order=desc&per_page=10`
  ) as { items?: { name?: string; full_name?: string; html_url?: string; description?: string; stargazers_count?: number; pushed_at?: string }[] };

  return (data.items ?? []).flatMap((repo) => {
    if (!repo.html_url) return [];
    return [{
      title:       `[GitHub] ${repo.full_name ?? repo.name ?? ''}`,
      link:        repo.html_url,
      summary:     repo.description ?? `Stars: ${repo.stargazers_count ?? 0}`,
      source:      'GitHub Trending',
      publishedAt: repo.pushed_at ? new Date(repo.pushed_at) : new Date(),
    }];
  });
}

// ── Reddit r/MachineLearning ───────────────────────────────
async function fetchRedditML(): Promise<FeedItem[]> {
  const data = await httpsGetJson(
    'https://www.reddit.com/r/MachineLearning/hot.json?limit=10'
  ) as { data?: { children?: { data?: { title?: string; url?: string; selftext?: string; created_utc?: number; score?: number; permalink?: string } }[] } };

  return (data.data?.children ?? []).flatMap((child) => {
    const post = child.data;
    if (!post?.title) return [];
    const link = post.url?.startsWith('http') ? post.url : `https://reddit.com${post.permalink ?? ''}`;
    return [{
      title:       post.title,
      link,
      summary:     post.selftext ? post.selftext.slice(0, 100) : `Reddit score: ${post.score ?? 0}`,
      source:      'Reddit r/ML',
      publishedAt: post.created_utc ? new Date(post.created_utc * 1000) : new Date(),
    }];
  });
}

// ── HackerNoon ─────────────────────────────────────────────
async function fetchHackerNoon(): Promise<FeedItem[]> {
  const xml = await httpsGetText('https://hackernoon.com/feed');
  return parseRssFeed(xml, 'HackerNoon', 10);
}

// ── TechCrunch ─────────────────────────────────────────────
async function fetchTechCrunch(): Promise<FeedItem[]> {
  const xml = await httpsGetText('https://techcrunch.com/feed/');
  return parseRssFeed(xml, 'TechCrunch', 10);
}

// ── Ars Technica ───────────────────────────────────────────
async function fetchArsTechnica(): Promise<FeedItem[]> {
  const xml = await httpsGetText('https://feeds.arstechnica.com/arstechnica/index');
  return parseRssFeed(xml, 'Ars Technica', 10);
}

// ── MIT Technology Review ──────────────────────────────────
async function fetchMITTechReview(): Promise<FeedItem[]> {
  const xml = await httpsGetText('https://www.technologyreview.com/feed/');
  return parseRssFeed(xml, 'MIT Tech Review', 10);
}

// ── メイン ─────────────────────────────────────────────────
export async function fetchLatestItems(): Promise<FeedItem[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24時間以内

  const results = await Promise.allSettled([
    fetchHackerNews(),
    fetchDevTo(),
    fetchLobsters(),
    fetchGitHubTrending(),
    fetchRedditML(),
    fetchHackerNoon(),
    fetchTechCrunch(),
    fetchArsTechnica(),
    fetchMITTechReview(),
  ]);

  const items: FeedItem[] = [];
  const labels = [
    'Hacker News',
    'Dev.to',
    'Lobste.rs',
    'GitHub Trending',
    'Reddit r/ML',
    'HackerNoon',
    'TechCrunch',
    'Ars Technica',
    'MIT Tech Review',
  ];

  for (const [i, r] of results.entries()) {
    if (r.status === 'fulfilled') {
      // GitHub Trending / Reddit は期間が7日以内なので cutoff フィルタを緩める
      const noFilter = labels[i] === 'GitHub Trending' || labels[i] === 'Reddit r/ML';
      const filtered = noFilter
        ? r.value
        : r.value.filter((item) => item.publishedAt >= cutoff);
      items.push(...filtered);
    } else {
      console.warn(`RSS取得失敗 [${labels[i]}]:`, (r.reason as Error).message);
    }
  }

  return items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
