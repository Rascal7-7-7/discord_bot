import { Events, MessageReaction, PartialMessageReaction, User, PartialUser } from 'discord.js';
import { addBookmark, messageExistsInDb } from '../services/bookmarkService';

export const name = Events.MessageReactionAdd;

export async function execute(
  reaction: MessageReaction | PartialMessageReaction,
  user: User | PartialUser
): Promise<void> {
  if (user.bot) return;
  if (reaction.emoji.name !== '⭐') return;

  try {
    // Partial の場合はフェッチして完全なオブジェクトに復元
    const fullReaction = reaction.partial ? await reaction.fetch() : reaction;
    const message = fullReaction.message.partial
      ? await fullReaction.message.fetch()
      : fullReaction.message;

    if (!message.guildId) return;

    // 追跡チャンネルのDB保存済みメッセージのみ対象
    const exists = await messageExistsInDb(message.id);
    if (!exists) return;

    const fullUser = user.partial ? await user.fetch() : user;
    await addBookmark(message.id, fullUser.id, message.guildId);
  } catch (error) {
    console.error('[reactionAdd] ブックマーク追加エラー:', error);
  }
}
