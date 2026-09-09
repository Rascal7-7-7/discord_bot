import { describe, it, expect, vi, beforeEach } from 'vitest';

// https モジュール全体をモック（外部通信しない）
vi.mock('https', () => ({
  default: {
    get: vi.fn(),
  },
}));

// env は requireEnv() で GITHUB_TOKEN を要求するため、テストでは差し替える
vi.mock('../config/env', () => ({
  config: {
    githubToken: 'test-token',
    discordToken: 'x',
    trendChannelId: 'x',
    logChannelId: 'x',
  },
}));

import https from 'https';
import { fetchLatestItems, type FeedItem } from './rssService';

const mockHttpsGet = vi.mocked(https.get);

/** GitHub Search API の応答を模す */
function makeGitHubResponse(repos: object[]) {
  return { items: repos };
}

/** https.get の callback へ JSON を1回流す */
function mockGetJson(response: unknown) {
  mockHttpsGet.mockImplementation((..._args: unknown[]) => {
    const callback = _args[_args.length - 1];
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

describe('fetchLatestItems', () => {
  beforeEach(() => {
    mockHttpsGet.mockReset();
  });

  it('GitHub のリクエストに Authorization ヘッダを付ける', async () => {
    // 未認証だと GitHub Search API のレート制限に当たる。
    // ヘッダが落ちても取得自体は成功するので、テストが無いと黙って劣化する
    mockGetJson(makeGitHubResponse([]));
    await fetchLatestItems();

    const authorized = mockHttpsGet.mock.calls.filter((call) => {
      const opts = call.find(
        (a) => typeof a === 'object' && a !== null && 'headers' in (a as object),
      ) as { headers?: Record<string, string> } | undefined;
      return Boolean(opts?.headers?.Authorization);
    });
    expect(authorized.length).toBeGreaterThan(0);
    expect(authorized[0]).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'token test-token' }),
        }),
      ]),
    );
  });

  it('GitHub Trending の項目を FeedItem として返す', async () => {
    mockGetJson(
      makeGitHubResponse([
        {
          full_name: 'octo/demo',
          html_url: 'https://github.com/octo/demo',
          description: 'a demo repo',
          stargazers_count: 123,
          created_at: '2026-09-08T00:00:00Z',
        },
      ]),
    );
    const items = await fetchLatestItems();
    const github = items.filter((i: FeedItem) => i.source === 'GitHub Trending');
    expect(github.length).toBeGreaterThan(0);
    expect(github[0].link).toBe('https://github.com/octo/demo');
  });

  it('1つのソースが失敗しても全体は落ちない', async () => {
    // Promise.allSettled で束ねているので、1件の失敗で空配列にはならない
    let first = true;
    mockHttpsGet.mockImplementation((..._args: unknown[]) => {
      if (first) {
        first = false;
        throw new Error('boom');
      }
      const callback = _args[_args.length - 1];
      const cb = callback as (res: {
        statusCode: number;
        headers: Record<string, string>;
        on: (event: string, handler: (chunk?: Buffer) => void) => void;
      }) => void;
      const body = Buffer.from(JSON.stringify(makeGitHubResponse([])));
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

    await expect(fetchLatestItems()).resolves.toBeInstanceOf(Array);
  });
});
