import { pool } from '../db/pool';
import type { SearchResult } from './searchService';

export interface BookmarkResult extends SearchResult {
  bookmarked_at: Date;
}

/** ブックマークを追加する（重複時はスキップ） */
export async function addBookmark(
  messageId: string,
  userId: string,
  guildId: string
): Promise<void> {
  await pool.query(
    `INSERT INTO bookmarks (message_id, user_id, guild_id) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
    [messageId, userId, guildId]
  );
}

/** ブックマークを削除する */
export async function removeBookmark(messageId: string, userId: string): Promise<void> {
  await pool.query(
    `DELETE FROM bookmarks WHERE message_id = $1 AND user_id = $2`,
    [messageId, userId]
  );
}

/** ユーザーのブックマーク一覧を取得する */
export async function getBookmarks(
  userId: string,
  guildId: string,
  limit: number = 10
): Promise<BookmarkResult[]> {
  const result = await pool.query<BookmarkResult>(
    `SELECT m.id, m.channel_id, m.guild_id, m.author_username, m.content, m.created_at,
            b.created_at AS bookmarked_at
     FROM bookmarks b
     JOIN messages m ON b.message_id = m.id
     WHERE b.user_id = $1 AND b.guild_id = $2
     ORDER BY b.created_at DESC
     LIMIT $3`,
    [userId, guildId, limit]
  );
  return result.rows;
}

/** メッセージがDBに存在するか確認する */
export async function messageExistsInDb(messageId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT 1 FROM messages WHERE id = $1',
    [messageId]
  );
  return result.rows.length > 0;
}
