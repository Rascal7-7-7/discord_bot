/**
 * setup-channels.ts
 * 監視対象チャンネルをDBに登録するセットアップスクリプト
 *
 * 使い方: npm run setup-channels
 */

import { Client, GatewayIntentBits } from 'discord.js';
import { config } from '../config/env';
import { pool } from '../db/pool';

// ============================================================
// 監視対象チャンネルID一覧
// カテゴリIDはDISCORDの表示用のみ（DBには登録しない）
// ============================================================
const TRACKED_CHANNELS: { id: string; label: string }[] = [
  // 【02】トレンド&リサーチ
  { id: '1485180205017600082', label: 'トレンド速報' },
  { id: '1485180644995633293', label: '競合・市場分析' },
  { id: '1487443454765174855', label: 'ひらめきアイデア💡' },

  // 【04】スキル保管庫
  { id: '1485183188879015988', label: '動画編集-tips' },
  { id: '1485183375391064219', label: 'デザイン-tips' },
  { id: '1485183500801015929', label: 'aiプロンプト集' },
  { id: '1487465395723042967', label: 'windows-tips' },
  { id: '1487465435548090478', label: 'mac-tips' },
  { id: '1485183610276413640', label: 'マーケ・営業術' },
  { id: '1487440817122574516', label: 'マネーリテラシー' },
  { id: '1485183723556311061', label: '入門教材リンク' },

  // 【05】AIアシスタント・効率化
  { id: '1485183954062413914', label: 'aiメンター相談' },
  { id: '1485184065614381116', label: '要約・ドラフト生成' },
  { id: '1485184179359453245', label: '自動化ログ' },
];

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

async function setupChannels(): Promise<void> {
  await client.login(config.discordToken);
  await new Promise<void>((resolve) => client.once('clientReady', () => resolve()));

  const guild = await client.guilds.fetch(config.guildId);
  console.log(`Guild: ${guild.name} (${guild.id})`);

  // ギルドをupsert
  await pool.query(
    `INSERT INTO guilds (id, name, updated_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (id) DO UPDATE SET name = $2, updated_at = NOW()`,
    [guild.id, guild.name]
  );

  // チャンネル情報をDiscordから一括取得
  const allChannels = await guild.channels.fetch();

  let registered = 0;
  let notFound = 0;

  for (const { id, label } of TRACKED_CHANNELS) {
    const channel = allChannels.get(id);
    if (!channel) {
      console.warn(`  [NOT FOUND] ${label} (${id})`);
      notFound++;
      continue;
    }

    await pool.query(
      `INSERT INTO channels (id, guild_id, name, type, is_tracked, updated_at)
       VALUES ($1, $2, $3, $4, TRUE, NOW())
       ON CONFLICT (id) DO UPDATE SET name = $3, type = $4, is_tracked = TRUE, updated_at = NOW()`,
      [channel.id, guild.id, channel.name, channel.type]
    );
    console.log(`  [OK] #${channel.name} (${channel.id})`);
    registered++;
  }

  console.log(`\n登録完了: ${registered}チャンネル成功 / ${notFound}件 not found`);

  await pool.end();
  client.destroy();
}

setupChannels().catch((error) => {
  console.error('エラー:', error);
  process.exit(1);
});
