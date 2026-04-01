import Anthropic from '@anthropic-ai/sdk';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { pool } from '../db/pool';
import { config } from '../config/env';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

interface ChannelDigest {
  channelId: string;
  channelName: string;
  messageCount: number;
  summary: string;
}

/** 今週月曜日の日付文字列を UTC ベースで返す（YYYY-MM-DD） */
function getWeekStart(): string {
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun, 1=Mon
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(now);
  monday.setUTCDate(now.getUTCDate() + diff);
  return monday.toISOString().slice(0, 10);
}

/** 週次ダイジェストを生成して投稿する（TOCTOU 対応・冪等） */
export async function runWeeklyDigest(client: Client, guildId: string): Promise<void> {
  if (!config.digestChannelId) return;

  const weekStart = getWeekStart();

  // INSERT で先にスロットを取得（SELECT → INSERT の TOCTOU を回避）
  const claim = await pool.query(
    `INSERT INTO weekly_digests (guild_id, week_start)
     VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
    [guildId, weekStart]
  );
  if (claim.rows.length === 0) return; // 別インスタンスが先行済み

  // 過去7日間でアクティブな追跡チャンネル上位3件
  const channelsRes = await pool.query<{
    channel_id: string;
    channel_name: string;
    message_count: string;
  }>(
    `SELECT m.channel_id, c.name AS channel_name, COUNT(*) AS message_count
     FROM messages m
     JOIN channels c ON m.channel_id = c.id
     WHERE m.guild_id = $1
       AND m.created_at >= NOW() - INTERVAL '7 days'
       AND c.is_tracked = TRUE
     GROUP BY m.channel_id, c.name
     HAVING COUNT(*) >= 5
     ORDER BY message_count DESC
     LIMIT 3`,
    [guildId]
  );

  if (channelsRes.rows.length === 0) return;

  // チャンネルごとにメッセージ取得 + Claude 要約を並列実行
  const digests = await Promise.all(
    channelsRes.rows.map(async (ch): Promise<ChannelDigest> => {
      const msgsRes = await pool.query<{ author_username: string; content: string }>(
        `SELECT author_username, content
         FROM messages
         WHERE guild_id = $1 AND channel_id = $2
           AND created_at >= NOW() - INTERVAL '7 days'
         ORDER BY created_at ASC
         LIMIT 50`,
        [guildId, ch.channel_id]
      );

      const context = msgsRes.rows
        .map((m) => `${m.author_username}: ${m.content.slice(0, 200)}`)
        .join('\n')
        .slice(0, 3000);

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 512,
        system: `あなたはチームのコミュニケーション分析者です。
Discordチャンネルの1週間の会話を分析し、週次サマリーを日本語でまとめてください。
形式:
- 主なトピック（箇条書き2〜3点）
- 特記事項（あれば1点）
合計150字以内で簡潔に。`,
        messages: [{ role: 'user', content: context }],
      });

      const block = message.content[0];
      return {
        channelId: ch.channel_id,
        channelName: ch.channel_name,
        messageCount: parseInt(ch.message_count, 10),
        summary: block.type === 'text' ? block.text : '（要約取得失敗）',
      };
    })
  );

  // Discord に投稿
  const channel = await client.channels.fetch(config.digestChannelId).catch(() => null);
  if (!(channel instanceof TextChannel)) return;

  const embed = new EmbedBuilder()
    .setTitle(`📋 週次ダイジェスト（${weekStart} 週）`)
    .setColor(0x9b59b6)
    .setFooter({ text: 'discord-knowledge-bot' });

  for (const d of digests) {
    embed.addFields({
      name: `#${d.channelName}（${d.messageCount}件）`,
      value: d.summary.slice(0, 1024),
    });
  }

  await channel.send({ embeds: [embed] });
}

/** 週次ダイジェストのスケジューラを起動する（毎時チェック） */
export function startDigestScheduler(client: Client, guildId: string): void {
  const check = async () => {
    const now = new Date();
    // 月曜日の9:00 JST（= UTC 00:00）
    const isMonday = now.getUTCDay() === 1;
    const isMidnightUTC = now.getUTCHours() === 0;
    if (!isMonday || !isMidnightUTC) return;

    await runWeeklyDigest(client, guildId).catch((err: Error) => {
      console.error('[Digest] 週次ダイジェストエラー:', err.message);
    });
  };

  // 起動時に即時チェック（再起動がウィンドウ内に来ても発火）
  void check();
  setInterval(() => void check(), 60 * 60 * 1000);
  console.log('[Digest] 週次ダイジェストスケジューラ起動');
}
