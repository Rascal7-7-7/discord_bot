import { pool } from '../db/pool';
import type { SearchResult } from './searchService';

/** メッセージ内容から #タグ を抽出する（Discordチャンネルメンション除外） */
export function extractTags(content: string): string[] {
  const cleaned = content.replace(/<#\d+>/g, '');
  const matches = cleaned.match(/#([a-zA-Z\u3040-\u9FFF][a-zA-Z0-9\u3040-\u9FFF_]{1,49})/g) ?? [];
  return [...new Set(matches.map((m) => m.slice(1).toLowerCase()))];
}

/** タグをDBに保存する */
export async function saveTags(
  messageId: string,
  guildId: string,
  tags: string[]
): Promise<void> {
  if (tags.length === 0) return;

  const values: string[] = [];
  const params: (string)[] = [messageId, guildId];
  for (const tag of tags) {
    params.push(tag);
    values.push(`($1, $2, $${params.length})`);
  }

  await pool.query(
    `INSERT INTO message_tags (message_id, guild_id, tag) VALUES ${values.join(', ')} ON CONFLICT DO NOTHING`,
    params
  );
}

/** タグでメッセージを検索する */
export async function searchByTag(
  guildId: string,
  tag: string,
  limit: number = 10
): Promise<SearchResult[]> {
  const result = await pool.query<SearchResult>(
    `SELECT m.id, m.channel_id, m.guild_id, m.author_username, m.content, m.created_at
     FROM messages m
     JOIN message_tags mt ON m.id = mt.message_id
     WHERE mt.guild_id = $1 AND mt.tag = $2
     ORDER BY m.created_at DESC
     LIMIT $3`,
    [guildId, tag.toLowerCase(), limit]
  );
  return result.rows;
}

/** タグ絞り込み + キーワード AND検索 */
export async function searchByTagAndKeywords(
  guildId: string,
  tag: string,
  keywords: string[],
  limit: number = 10
): Promise<SearchResult[]> {
  const conditions = keywords.map((_, i) => `m.content ILIKE $${i + 3}`);
  const keywordClause = conditions.length > 0 ? `AND ${conditions.join(' AND ')}` : '';
  const params: (string | number)[] = [
    guildId,
    tag.toLowerCase(),
    ...keywords.map((k) => `%${k}%`),
    limit,
  ];

  const result = await pool.query<SearchResult>(
    `SELECT m.id, m.channel_id, m.guild_id, m.author_username, m.content, m.created_at
     FROM messages m
     JOIN message_tags mt ON m.id = mt.message_id
     WHERE mt.guild_id = $1 AND mt.tag = $2 ${keywordClause}
     ORDER BY m.created_at DESC
     LIMIT $${params.length}`,
    params
  );
  return result.rows;
}
