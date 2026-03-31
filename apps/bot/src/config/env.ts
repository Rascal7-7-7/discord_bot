import dotenv from 'dotenv';
import path from 'path';

// プロジェクトルートの.envを読み込む
dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

interface Config {
  databaseUrl: string;
  discordToken: string;
  clientId: string;
  guildId: string;
  anthropicApiKey: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`環境変数 ${key} が設定されていません`);
  }
  return value;
}

export const config: Config = {
  databaseUrl: requireEnv('DATABASE_URL'),
  discordToken: requireEnv('DISCORD_TOKEN'),
  clientId: requireEnv('CLIENT_ID'),
  guildId: requireEnv('GUILD_ID'),
  anthropicApiKey: requireEnv('ANTHROPIC_API_KEY'),
};
