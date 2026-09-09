import * as cheerio from 'cheerio';

export interface FetchedContent {
  title: string;
  body: string;
  type: 'youtube' | 'article';
}

const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^`[\]]+/g;
const YOUTUBE_REGEX = /(?:youtube\.com\/watch\?|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

export function extractUrls(text: string): string[] {
  return text.match(URL_REGEX) ?? [];
}

export function isYouTubeUrl(url: string): boolean {
  return YOUTUBE_REGEX.test(url);
}

export async function fetchContent(url: string): Promise<FetchedContent | null> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DiscordBot/1.0)' },
      signal: AbortSignal.timeout(10000),
    });
    if (!res.ok) return null;

    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr('content') ??
      $('title').text().trim() ??
      url;

    const description =
      $('meta[property="og:description"]').attr('content') ??
      $('meta[name="description"]').attr('content') ??
      '';

    const isYt = isYouTubeUrl(url);

    let body = description;
    if (!isYt) {
      $('nav, header, footer, script, style, aside').remove();
      const articleText = $('article, main, [role="main"]').first().text();
      const fallback = $('body').text();
      body = (articleText || fallback)
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 3000);
    }

    return { title, body: body || description, type: isYt ? 'youtube' : 'article' };
  } catch {
    return null;
  }
}
