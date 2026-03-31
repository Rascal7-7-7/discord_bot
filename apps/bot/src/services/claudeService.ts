import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

/** AIメンターとして質問に回答する */
export async function askMentor(question: string, username: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `あなたはビジネス・クリエイター向けのAIメンターです。
チームメンバーの質問に、マーケティング・動画編集・SNS運用・デザイン・営業などの観点から
実践的で具体的なアドバイスを日本語で返してください。
回答は簡潔に、箇条書きや見出しを使って読みやすくしてください。`,
    messages: [
      { role: 'user', content: `${username}からの質問:\n\n${question}` },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '（応答を取得できませんでした）';
}

/** URLコンテンツを要約する */
export async function summarizeContent(
  content: string,
  url: string,
  type: 'youtube' | 'article'
): Promise<string> {
  const label = type === 'youtube' ? 'YouTube動画' : 'ウェブ記事';

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `あなたはコンテンツ要約の専門家です。
${label}の内容を以下の形式で日本語で要約してください：

## 📝 概要
（2〜3文で内容を説明）

## 💡 重要なポイント
（箇条書きで3〜5つ）

## 🚀 ビジネス活用法
（このチームでどう使えるか、1〜2文）`,
    messages: [
      { role: 'user', content: `URL: ${url}\n\n内容:\n${content}` },
    ],
  });

  const block = message.content[0];
  return block.type === 'text' ? block.text : '（要約を取得できませんでした）';
}
