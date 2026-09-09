import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

/** AIメンターとして質問に回答する */
export async function askMentor(question: string, username: string): Promise<string> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: `あなたはSNS副業・AI活用・コンテンツビジネスに特化したメンターです。
対象: AI・SNS・副業に取り組むクリエイター・フリーランス・小規模事業者。

回答ルール:
- 抽象論より「今日から使える具体的アクション」を優先する
- ツール名・数字・ステップを明示する（例: n8nで自動化、Claudeで下書き生成）
- マーケティング・SNS運用・動画・デザイン・収益化の観点を状況に応じて選ぶ
- 200字以内でまず結論、詳細は箇条書きで補足する`,
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
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
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
