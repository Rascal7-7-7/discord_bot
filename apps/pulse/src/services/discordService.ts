import {
  Client,
  TextChannel,
  ThreadAutoArchiveDuration,
  EmbedBuilder,
} from 'discord.js';
import { config } from '../config/env';
import type { AnalyzedItem } from './claudeService';

const PERSONA_TAG: Record<string, string> = {
  '動画編集者':  '🎬 動画編集者向け',
  'SNS運用者':  '📱 SNS運用者向け',
  'マーケター':  '📣 マーケター向け',
  'デザイナー':  '🎨 デザイナー向け',
  'ビジネス全般': '💼 ビジネス全般',
};

function tag(persona: string): string {
  return PERSONA_TAG[persona] ?? `📌 ${persona}`;
}

export async function postTrends(client: Client, items: AnalyzedItem[]): Promise<void> {
  if (items.length === 0) return;

  const channel = await client.channels.fetch(config.trendChannelId);
  if (!(channel instanceof TextChannel)) {
    console.error('トレンドチャンネルが見つかりません:', config.trendChannelId);
    return;
  }

  const now = new Date().toLocaleDateString('ja-JP', {
    month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
  });

  // サマリーメッセージを投稿してスレッドを作成
  const summary = await channel.send(
    `## 🔍 トレンドレポート — ${now}\n${items.length}件のトレンドを検出しました`
  );

  const thread = await summary.startThread({
    name: `📊 ${now} のトレンド詳細`,
    autoArchiveDuration: ThreadAutoArchiveDuration.OneWeek,
  });

  // 各アイテムをEmbedで投稿
  for (const item of items) {
    const embed = new EmbedBuilder()
      .setColor(0x5865f2)
      .setTitle(`${item.emoji} ${item.title}`)
      .setURL(item.link || null)
      .addFields(
        { name: '対象',     value: tag(item.persona),    inline: true },
        { name: 'ソース',   value: item.source,           inline: true },
        { name: '⚡ 重要な理由',  value: item.importance },
        { name: '🚀 活用法',      value: item.application },
      )
      .setFooter({ text: 'Pulse by 破血ホールディングス' })
      .setTimestamp();

    await thread.send({ embeds: [embed] });
  }
}

export async function postLog(client: Client, message: string): Promise<void> {
  try {
    const channel = await client.channels.fetch(config.logChannelId);
    if (channel instanceof TextChannel) {
      await channel.send(message);
    }
  } catch (err) {
    console.error('ログ投稿失敗:', (err as Error).message);
  }
}
