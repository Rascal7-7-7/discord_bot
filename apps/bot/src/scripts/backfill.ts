/**
 * backfill.ts
 * 監視対象チャンネルの過去メッセージをDBに一括取得するスクリプト
 *
 * 使い方: npm run backfill
 * 前提: 先に npm run setup-channels を実行しておくこと
 */

import {
  Client,
  Collection,
  GatewayIntentBits,
  Message,
  Snowflake,
  TextChannel,
} from 'discord.js';
import { config } from '../config/env';
import { pool } from '../db/pool';

const BATCH_SIZE = 100;
const DELAY_MS = 500; // レート制限対策

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function saveBatch(
  messages: Collection<Snowflake, Message>,
  guildId: string,
  channelId: string
): Promise<number> {
  let saved = 0;
  for (const message of messages.values()) {
    if (message.author.bot) continue;

    const attachments = [...message.attachments.values()].map((a) => ({
      id: a.id,
      url: a.url,
      name: a.name,
      size: a.size,
    }));

    await pool.query(
      `INSERT INTO messages
         (id, channel_id, guild_id, author_id, author_username, content, attachments, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (id) DO NOTHING`,
      [
        message.id,
        channelId,
        guildId,
        message.author.id,
        message.author.username,
        message.content,
        JSON.stringify(attachments),
        message.createdAt.toISOString(),
      ]
    );
    saved++;
  }
  return saved;
}

async function backfillChannel(channel: TextChannel, guildId: string): Promise<void> {
  console.log(`\n--- #${channel.name} (${channel.id}) ---`);

  // sync_states を syncing に設定
  await pool.query(
    `INSERT INTO sync_states (guild_id, channel_id, status, updated_at)
     VALUES ($1, $2, 'syncing', NOW())
     ON CONFLICT (guild_id, channel_id) DO UPDATE
       SET status = 'syncing', error_message = NULL, updated_at = NOW()`,
    [guildId, channel.id]
  );

  let before: string | undefined = undefined;
  let totalSaved = 0;
  let batchCount = 0;

  try {
    while (true) {
      const fetchOptions: { limit: number; before?: string } = { limit: BATCH_SIZE };
      if (before) fetchOptions.before = before;

      const messages = await channel.messages.fetch(fetchOptions);
      if (messages.size === 0) break;

      const saved = await saveBatch(messages, guildId, channel.id);
      totalSaved += saved;
      batchCount++;

      const oldest = messages.last();
      before = oldest?.id;

      console.log(
        `  バッチ${batchCount}: ${messages.size}件取得 / ${saved}件保存 (累計: ${totalSaved}件)`
      );

      if (messages.size < BATCH_SIZE) break;

      await sleep(DELAY_MS);
    }

    // 完了: sync_states を idle に更新
    await pool.query(
      `UPDATE sync_states
       SET status = 'idle', last_synced_at = NOW(), last_synced_message_id = NULL,
           error_message = NULL, updated_at = NOW()
       WHERE channel_id = $1`,
      [channel.id]
    );

    console.log(`  完了 — 合計 ${totalSaved}件保存`);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    await pool.query(
      `UPDATE sync_states
       SET status = 'error', error_message = $1, updated_at = NOW()
       WHERE channel_id = $2`,
      [msg, channel.id]
    );
    console.error(`  エラー: ${msg}`);
  }
}

async function backfill(): Promise<void> {
  await client.login(config.discordToken);
  await new Promise<void>((resolve) => client.once('clientReady', () => resolve()));

  const rows = await pool.query<{ id: string; name: string; guild_id: string }>(
    'SELECT id, name, guild_id FROM channels WHERE is_tracked = TRUE ORDER BY name'
  );

  if (rows.rowCount === 0) {
    console.error('監視対象チャンネルがありません。先に npm run setup-channels を実行してください。');
    await cleanup();
    return;
  }

  console.log(`${rows.rowCount}チャンネルのバックフィルを開始します\n`);

  for (const row of rows.rows) {
    try {
      const channel = await client.channels.fetch(row.id);
      if (!(channel instanceof TextChannel)) {
        console.warn(`スキップ (テキストチャンネルではない): ${row.name}`);
        continue;
      }
      await backfillChannel(channel, row.guild_id);
    } catch (error) {
      console.error(`チャンネル取得失敗: ${row.name} (${row.id})`, error);
    }
  }

  console.log('\n全チャンネルのバックフィル完了');
  await cleanup();
}

async function cleanup(): Promise<void> {
  await pool.end();
  client.destroy();
}

backfill().catch((error) => {
  console.error('バックフィルエラー:', error);
  process.exit(1);
});
