import {
  Events,
  Message,
  TextChannel,
  ThreadAutoArchiveDuration,
} from 'discord.js';
import {
  isTrackedChannel,
  saveMessage,
  upsertChannel,
  upsertGuild,
} from '../services/messageService';
import { askMentor, summarizeContent } from '../services/claudeService';
import { extractUrls, fetchContent } from '../services/contentService';

export const name = Events.MessageCreate;

export async function execute(message: Message): Promise<void> {
  if (message.author.bot) return;
  if (!message.guild) return;

  const isMentioned = message.mentions.users.has(message.client.user!.id);

  // @メンション → AIメンター（どのチャンネルでも動作）
  if (isMentioned) {
    await handleMentor(message);
  }

  // 追跡チャンネル処理（DB保存 + URL要約）
  try {
    const tracked = await isTrackedChannel(message.channelId);
    if (!tracked) return;

    await upsertGuild(message.guild.id, message.guild.name);
    if (message.channel.isTextBased() && 'name' in message.channel && message.channel.name) {
      await upsertChannel(
        message.channelId,
        message.guild.id,
        message.channel.name,
        message.channel.type
      );
    }
    await saveMessage(message);

    // URL要約（@mentionメッセージは除外して二重応答を防ぐ）
    if (!isMentioned) {
      const urls = extractUrls(message.content);
      if (urls.length > 0) {
        await handleUrlSummary(message, urls[0]);
      }
    }
  } catch (error) {
    console.error('メッセージ処理エラー:', error);
  }
}

async function handleMentor(message: Message): Promise<void> {
  const question = message.content.replace(/<@!?\d+>/g, '').trim();
  if (!question) {
    await message.reply('何か質問があればどうぞ！例: `@Bot 営業文を1つ作って`');
    return;
  }

  try {
    if ('sendTyping' in message.channel) await message.channel.sendTyping();
    const answer = await askMentor(question, message.author.username);

    if (canStartThread(message)) {
      const thread = await message.startThread({
        name: `💬 ${message.author.username}の相談`,
        autoArchiveDuration: ThreadAutoArchiveDuration.OneDay,
      });
      await thread.send(answer);
    } else {
      await message.reply(answer);
    }
  } catch (error) {
    console.error('AIメンターエラー:', error);
    await message.reply('回答の生成中にエラーが発生しました。').catch(() => undefined);
  }
}

async function handleUrlSummary(message: Message, url: string): Promise<void> {
  try {
    const content = await fetchContent(url);
    if (!content || !content.body) return;

    if ('sendTyping' in message.channel) await message.channel.sendTyping();
    const summary = await summarizeContent(content.body, url, content.type);
    const label = content.type === 'youtube' ? '🎬 動画要約' : '📄 記事要約';
    const threadName = `${label}: ${content.title.slice(0, 80)}`;
    const body = `**${content.title}**\n\n${summary}`;

    if (canStartThread(message)) {
      const thread = await message.startThread({
        name: threadName,
        autoArchiveDuration: ThreadAutoArchiveDuration.ThreeDays,
      });
      await thread.send(body);
    } else {
      await message.reply(body);
    }
  } catch (error) {
    console.error('URL要約エラー:', error);
  }
}

/** メッセージからスレッドを開始できるか判定 */
function canStartThread(message: Message): boolean {
  return message.channel instanceof TextChannel;
}
