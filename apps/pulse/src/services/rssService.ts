import https from 'https';

export interface FeedItem {
  title: string;
  link: string;
  summary: string;
  source: string;
  publishedAt: Date;
}

/** Node.js 組み込み https で JSON 取得 */
function httpsGetJson(urlStr: string): Promise<unknown> {
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
        httpsGetJson(res.headers.location).then(resolve).catch(reject);
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

// ── メイン ─────────────────────────────────────────────────
export async function fetchLatestItems(): Promise<FeedItem[]> {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24時間以内

  const results = await Promise.allSettled([
    fetchHackerNews(),
    fetchDevTo(),
    fetchLobsters(),
    fetchGitHubTrending(),
  ]);

  const items: FeedItem[] = [];
  const labels = ['Hacker News', 'Dev.to', 'Lobste.rs', 'GitHub Trending'];
  for (const [i, r] of results.entries()) {
    if (r.status === 'fulfilled') {
      // GitHub Trending は created が7日以内なので cutoff フィルタを緩める
      const filter = labels[i] === 'GitHub Trending'
        ? r.value
        : r.value.filter((item) => item.publishedAt >= cutoff);
      items.push(...filter);
    } else {
      console.warn(`RSS取得失敗 [${labels[i]}]:`, (r.reason as Error).message);
    }
  }

  return items.sort((a, b) => b.publishedAt.getTime() - a.publishedAt.getTime());
}
