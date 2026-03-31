import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../../.env') });

interface Config {
  discordToken: string;
  anthropicApiKey: string;
  trendChannelId: string;
  logChannelId: string;
}

function requireEnv(key: string): string {
  const value = process.env[key];
  if (!value) throw new Error(`環境変数 ${key} が設定されていません`);
  return value;
}

export const config: Config = {
  discordToken:    requireEnv('PULSE_DISCORD_TOKEN'),
  anthropicApiKey: requireEnv('ANTHROPIC_API_KEY'),
  trendChannelId:  requireEnv('PULSE_TREND_CHANNEL_ID'),
  logChannelId:    requireEnv('PULSE_LOG_CHANNEL_ID'),
};
