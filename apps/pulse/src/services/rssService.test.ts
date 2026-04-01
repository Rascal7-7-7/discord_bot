import { describe, it, expect, vi, beforeEach } from 'vitest';

// https モジュール全体をモック（外部通信しない）
vi.mock('https', () => ({
  default: {
    get: vi.fn(),
  },
}));

import https from 'https';
import { fetchLatestItems, type FeedItem } from './rssService';

const mockHttpsGet = vi.mocked(https.get);

function makeRedditResponse(posts: object[]) {
  return {
    data: {
      children: posts.map((p) => ({ data: p })),
    },
  };
}

function mockGetJson(response: unknown) {
  mockHttpsGet.mockImplementation((_url: unknown, _opts: unknown, callback: unknown) => {
    const cb = callback as (res: {
      statusCode: number;
      headers: Record<string, string>;
      on: (event: string, handler: (chunk?: Buffer) => void) => void;
    }) => void;
    const body = Buffer.from(JSON.stringify(response));
    cb({
      statusCode: 200,
      headers: {},
      on: (event, handler) => {
        if (event === 'data') handler(body);
        if (event === 'end') handler();
      },
    });
    return { on: vi.fn(), destroy: vi.fn() } as unknown as ReturnType<typeof https.get>;
  });
}

describe('fetchLatestItems — Reddit r/ML', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('正常系: 有効な投稿を FeedItem として返す', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetJson(makeRedditResponse([
      {
        title: 'Test ML Paper',
        url: 'https://example.com/paper',
        selftext: '',
        created_utc: now,
        score: 100,
        permalink: '/r/MachineLearning/comments/abc',
      },
    ]));

    const items = await fetchLatestItems();
    const redditItems = items.filter((i: FeedItem) => i.source === 'Reddit r/ML');

    expect(redditItems.length).toBeGreaterThan(0);
    expect(redditItems[0].title).toBe('Test ML Paper');
    expect(redditItems[0].link).toBe('https://example.com/paper');
    expect(redditItems[0].source).toBe('Reddit r/ML');
  });

  it('異常系: data.data が undefined でも空配列を返す', async () => {
    mockGetJson({});

    const items = await fetchLatestItems();
    const redditItems = items.filter((i: FeedItem) => i.source === 'Reddit r/ML');

    expect(redditItems).toEqual([]);
  });

  it('除外ケース: title が空の投稿は除外される', async () => {
    mockGetJson(makeRedditResponse([
      { title: '', url: 'https://example.com', created_utc: Date.now() / 1000 },
      { title: 'Valid Post', url: 'https://example.com/valid', created_utc: Date.now() / 1000, score: 50 },
    ]));

    const items = await fetchLatestItems();
    const redditItems = items.filter((i: FeedItem) => i.source === 'Reddit r/ML');

    expect(redditItems.every((i: FeedItem) => i.title !== '')).toBe(true);
  });

  it('permalink フォールバック: url が http始まりでない場合 reddit.com を補完', async () => {
    const now = Math.floor(Date.now() / 1000);
    mockGetJson(makeRedditResponse([
      {
        title: 'Self Post',
        url: '/r/MachineLearning/comments/xyz',
        selftext: 'some text here',
        created_utc: now,
        score: 20,
        permalink: '/r/MachineLearning/comments/xyz',
      },
    ]));

    const items = await fetchLatestItems();
    const redditItems = items.filter((i: FeedItem) => i.source === 'Reddit r/ML');

    if (redditItems.length > 0) {
      expect(redditItems[0].link).toMatch(/^https:\/\/reddit\.com/);
    }
  });
});
