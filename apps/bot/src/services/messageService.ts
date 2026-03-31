import { pool } from '../db/pool';
import type { Message } from 'discord.js';

/** メッセージをDBに保存する（重複時はスキップ） */
export async function saveMessage(message: Message): Promise<void> {
  const attachments = message.attachments.map((a) => ({
    id: a.id,
    url: a.url,
    name: a.name,
    size: a.size,
  }));

  await pool.query(
    `INSERT INTO messages (id, channel_id, guild_id, author_id, author_username, content, attachments, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (id) DO NOTHING`,
    [
      message.id,
      message.channelId,
      message.guildId,
      message.author.id,
      message.author.username,
      message.content,
      JSON.stringify(attachments),
      message.createdAt.toISOString(),
    ]
  );
}

/** チャンネルが保存対象かチェック */
export async function isTrackedChannel(channelId: string): Promise<boolean> {
  const result = await pool.query(
    'SELECT is_tracked FROM channels WHERE id = $1',
    [channelId]
  );
  return result.rows.length > 0 && result.rows[0].is_tracked === true;
}

/** ギルドを登録/更新する */
export async function upsertGuild(id: string, name: string): Promise<void> {
  await pool.query(
    `INSERT INTO guilds (id, name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET name = $2, updated_at = NOW()`,
    [id, name]
  );
}

/** チャンネルを登録/更新する */
export async function upsertChannel(
  id: string,
  guildId: string,
  name: string,
  type: number
): Promise<void> {
  await pool.query(
    `INSERT INTO channels (id, guild_id, name, type, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET name = $3, type = $4, updated_at = NOW()`,
    [id, guildId, name, type]
  );
}

/** チャンネルを監視対象に設定する */
export async function trackChannel(
  id: string,
  guildId: string,
  name: string,
  type: number
): Promise<void> {
  await pool.query(
    `INSERT INTO channels (id, guild_id, name, type, is_tracked, updated_at)
     VALUES ($1, $2, $3, $4, TRUE, NOW())
     ON CONFLICT (id) DO UPDATE SET name = $3, type = $4, is_tracked = TRUE, updated_at = NOW()`,
    [id, guildId, name, type]
  );
}
