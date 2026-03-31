import http from 'http';
import cron from 'node-cron';
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config/env';
import { fetchLatestItems } from './services/rssService';
import { analyzeItems } from './services/claudeService';
import { postTrends, postLog } from './services/discordService';

const client = new Client({
  intents: [GatewayIntentBits.Guilds],
});

// Cloud Run ヘルスチェック用
const port = process.env.PORT ?? '8080';
http.createServer((_, res) => {
  res.writeHead(200);
  res.end('ok');
}).listen(port, () => {
  console.log(`Health check server listening on port ${port}`);
});

async function runTrendReport(): Promise<void> {
  console.log('[Pulse] トレンドレポート開始');
  const startedAt = new Date().toLocaleString('ja-JP');

  try {
    const items = await fetchLatestItems();
    console.log(`[Pulse] RSS取得: ${items.length}件`);

    if (items.length === 0) {
      await postLog(client, `ℹ️ ${startedAt} — 新着トレンドなし`);
      return;
    }

    const analyzed = await analyzeItems(items);
    console.log(`[Pulse] 分析完了: ${analyzed.length}件`);

    if (analyzed.length === 0) {
      await postLog(client, `ℹ️ ${startedAt} — 関連トレンドなし（取得: ${items.length}件）`);
      return;
    }

    await postTrends(client, analyzed);
    await postLog(client, `✅ ${startedAt} — トレンドレポート完了（${analyzed.length}件投稿）`);
    console.log('[Pulse] 投稿完了');
  } catch (err) {
    const msg = (err as Error).message;
    console.error('[Pulse] エラー:', msg);
    await postLog(client, `❌ ${startedAt} — エラー: ${msg}`);
  }
}

async function main(): Promise<void> {
  await client.login(config.discordToken);
  await new Promise<void>((resolve) => client.once('clientReady', () => resolve()));
  console.log(`[Pulse] 起動完了: ${client.user!.tag}`);

  // 毎日 9:00 と 21:00 に実行（JST = UTC+9）
  cron.schedule('0 0,12 * * *', runTrendReport, { timezone: 'Asia/Tokyo' });
  console.log('[Pulse] スケジュール設定完了（毎日 9:00 / 21:00 JST）');

  // 起動直後に1回実行
  await runTrendReport();
}

main().catch((err) => {
  console.error('[Pulse] 起動エラー:', err);
  process.exit(1);
});
