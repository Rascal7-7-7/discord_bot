import { pool } from '../db/pool';

export interface ChannelStats {
  totalMessages: number;
  uniqueAuthors: number;
  hourlyDistribution: { hour: number; count: number }[];
  topAuthors: { username: string; count: number }[];
  dateRange: { oldest: Date; newest: Date } | null;
}

/** チャンネルの活動統計を取得する */
export async function getChannelStats(
  guildId: string,
  channelId: string,
  days: number = 30
): Promise<ChannelStats> {
  const [countRes, authorsRes, hourlyRes, topAuthorsRes] = await Promise.all([
    pool.query<{ total: string; oldest: Date | null; newest: Date | null }>(
      `SELECT COUNT(*) AS total, MIN(created_at) AS oldest, MAX(created_at) AS newest
       FROM messages
       WHERE guild_id = $1 AND channel_id = $2
         AND created_at >= NOW() - ($3 * INTERVAL '1 day')`,
      [guildId, channelId, days]
    ),
    pool.query<{ count: string }>(
      `SELECT COUNT(DISTINCT author_id) AS count
       FROM messages
       WHERE guild_id = $1 AND channel_id = $2
         AND created_at >= NOW() - ($3 * INTERVAL '1 day')`,
      [guildId, channelId, days]
    ),
    pool.query<{ hour: string; count: string }>(
      `SELECT EXTRACT(HOUR FROM created_at AT TIME ZONE 'Asia/Tokyo') AS hour, COUNT(*) AS count
       FROM messages
       WHERE guild_id = $1 AND channel_id = $2
         AND created_at >= NOW() - ($3 * INTERVAL '1 day')
       GROUP BY hour
       ORDER BY hour`,
      [guildId, channelId, days]
    ),
    pool.query<{ author_username: string; count: string }>(
      `SELECT author_username, COUNT(*) AS count
       FROM messages
       WHERE guild_id = $1 AND channel_id = $2
         AND created_at >= NOW() - ($3 * INTERVAL '1 day')
       GROUP BY author_username
       ORDER BY count DESC
       LIMIT 5`,
      [guildId, channelId, days]
    ),
  ]);

  const row = countRes.rows[0];
  const total = parseInt(row?.total ?? '0', 10);

  return {
    totalMessages: total,
    uniqueAuthors: parseInt(authorsRes.rows[0]?.count ?? '0', 10),
    hourlyDistribution: hourlyRes.rows.map((r) => ({
      hour: parseInt(r.hour, 10),
      count: parseInt(r.count, 10),
    })),
    topAuthors: topAuthorsRes.rows.map((r) => ({
      username: r.author_username,
      count: parseInt(r.count, 10),
    })),
    dateRange:
      total > 0 && row?.oldest && row?.newest
        ? { oldest: row.oldest, newest: row.newest }
        : null,
  };
}
