import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';
import { searchMessages, getRecentMessages } from './searchService';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

/** 過去メッセージをコンテキストとして Claude API に質問する */
export async function askWithContext(
  guildId: string,
  channelId: string,
  question: string,
  username: string
): Promise<string> {
  const keywords = question
    .split(/\s+/)
    .filter((k) => k.length >= 2)
    .slice(0, 5);

  const [keywordResults, recentResults] = await Promise.all([
    keywords.length > 0
      ? searchMessages(guildId, keywords, 15)
      : Promise.resolve([]),
    getRecentMessages(guildId, channelId, 20),
  ]);

  // 重複除去してコンテキスト構築（キーワード一致を優先）
  const seen = new Set<string>();
  const allMessages = [...keywordResults, ...recentResults].filter((m) => {
    if (seen.has(m.id)) return false;
    seen.add(m.id);
    return true;
  });

  const context = allMessages
    .map((m) => {
      const date = new Date(m.created_at).toLocaleDateString('ja-JP');
      return `[${date}] ${m.author_username}: ${m.content}`;
    })
    .join('\n')
    .slice(0, 4000);

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `あなたはチームの知識ベースアシスタントです。
以下はDiscordチャンネルの過去メッセージです。このコンテキストをもとに質問に答えてください。
コンテキストに関連情報がない場合は正直にその旨を伝え、一般的な知識で補足してください。
回答は簡潔に、箇条書きや見出しを使って読みやすくしてください。

【過去のメッセージ（コンテキスト）】
${context || '（保存済みメッセージなし）'}`,
    messages: [
      { role: 'user', content: `${username}からの質問:\n\n${question}` },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '（応答を取得できませんでした）';
}
