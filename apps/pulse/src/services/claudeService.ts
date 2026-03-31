import Anthropic from '@anthropic-ai/sdk';
import { config } from '../config/env';
import type { FeedItem } from './rssService';

const anthropic = new Anthropic({ apiKey: config.anthropicApiKey });

export interface AnalyzedItem {
  title: string;
  link: string;
  source: string;
  persona: string;   // 対象ペルソナ
  importance: string; // なぜ重要か
  application: string; // ビジネス活用法
  emoji: string;
}

const PERSONA_LIST = '動画編集者 / SNS運用者 / マーケター / デザイナー / ビジネス全般';

export async function analyzeItems(items: FeedItem[]): Promise<AnalyzedItem[]> {
  if (items.length === 0) return [];

  const itemsText = items
    .map((item, i) =>
      `[${i + 1}] タイトル: ${item.title}\n概要: ${item.summary || 'なし'}\nURL: ${item.link}`
    )
    .join('\n\n');

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: `あなたはビジネス・クリエイターチーム向けのトレンドアナリストです。
与えられたニュース記事を分析し、必ずJSON配列で返してください。

ペルソナ一覧: ${PERSONA_LIST}

各記事について以下を判定してください：
- persona: 最も関係するペルソナ（上記から1つ選択）
- importance: なぜ今重要か（1文、40字以内）
- application: チームのビジネスにどう活かせるか（1文、40字以内）
- emoji: 内容を表す絵文字（1文字）

ビジネスに無関係・重複・低品質な記事はスキップしてください。
必ず有効なJSONのみ返し、説明文は含めないでください。

出力形式:
[{"index": 1, "persona": "...", "importance": "...", "application": "...", "emoji": "..."}]`,
    messages: [{ role: 'user', content: itemsText }],
  });

  const block = message.content[0];
  if (block.type !== 'text') return [];

  let parsed: { index: number; persona: string; importance: string; application: string; emoji: string }[];
  try {
    const jsonMatch = block.text.match(/\[[\s\S]*\]/);
    if (!jsonMatch) return [];
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    console.error('Claude応答のJSONパース失敗:', block.text.slice(0, 200));
    return [];
  }

  return parsed.flatMap((result) => {
    const item = items[result.index - 1];
    if (!item) return [];
    return [{
      title:       item.title,
      link:        item.link,
      source:      item.source,
      persona:     result.persona,
      importance:  result.importance,
      application: result.application,
      emoji:       result.emoji,
    }];
  });
}
