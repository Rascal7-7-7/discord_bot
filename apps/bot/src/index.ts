import http from 'http';
import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config/env';
import { testConnection } from './db/pool';
import * as interactionCreate from './events/interactionCreate';
import * as messageCreate from './events/messageCreate';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// イベント登録
client.on(interactionCreate.name, interactionCreate.execute);
client.on(messageCreate.name, messageCreate.execute);

client.once('ready', (c) => {
  console.log(`Bot起動完了: ${c.user.tag}`);
});

// Cloud Run のヘルスチェック用 HTTP サーバー
const port = process.env.PORT ?? '8080';
http.createServer((_, res) => {
  res.writeHead(200);
  res.end('ok');
}).listen(port, () => {
  console.log(`Health check server listening on port ${port}`);
});

async function main(): Promise<void> {
  await testConnection();
  await client.login(config.discordToken);
}

main().catch((error) => {
  console.error('起動エラー:', error);
  process.exit(1);
});
