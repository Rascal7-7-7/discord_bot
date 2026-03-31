import { pool } from '../db/pool';

export interface SearchResult {
  id: string;
  channel_id: string;
  guild_id: string;
  author_username: string;
  content: string;
  created_at: Date;
}

/** AND検索（ILIKE）でメッセージを検索 */
export async function searchMessages(
  guildId: string,
  keywords: string[],
  limit: number = 10
): Promise<SearchResult[]> {
  // 各キーワードに対してILIKE条件を生成
  const conditions = keywords.map(
    (_, i) => `content ILIKE $${i + 2}`
  );
  const whereClause = conditions.join(' AND ');
  const params: string[] = [
    guildId,
    ...keywords.map((kw) => `%${kw}%`),
  ];

  const result = await pool.query<SearchResult>(
    `SELECT id, channel_id, guild_id, author_username, content, created_at
     FROM messages
     WHERE guild_id = $1 AND ${whereClause}
     ORDER BY created_at DESC
     LIMIT ${limit}`,
    params
  );

  return result.rows;
}

/** 最近のメッセージを取得 */
export async function getRecentMessages(
  guildId: string,
  channelId?: string,
  limit: number = 10
): Promise<SearchResult[]> {
  let query = `SELECT id, channel_id, guild_id, author_username, content, created_at
               FROM messages WHERE guild_id = $1`;
  const params: string[] = [guildId];

  if (channelId) {
    params.push(channelId);
    query += ` AND channel_id = $${params.length}`;
  }

  query += ` ORDER BY created_at DESC LIMIT ${limit}`;

  const result = await pool.query<SearchResult>(query, params);
  return result.rows;
}

/** チャンネルの要約用：直近メッセージを取得 */
export async function getMessagesForSummary(
  guildId: string,
  channelId: string,
  limit: number = 50
): Promise<SearchResult[]> {
  const result = await pool.query<SearchResult>(
    `SELECT id, channel_id, guild_id, author_username, content, created_at
     FROM messages
     WHERE guild_id = $1 AND channel_id = $2
     ORDER BY created_at DESC
     LIMIT $3`,
    [guildId, channelId, limit]
  );
  return result.rows;
}
