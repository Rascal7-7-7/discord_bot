import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { getBookmarks } from '../services/bookmarkService';
import { buildMessageLink, truncate } from '../utils/messageLink';

export const data = new SlashCommandBuilder()
  .setName('bookmarks')
  .setDescription('あなたのブックマーク一覧を表示します（⭐リアクションで保存）')
  .addIntegerOption((option) =>
    option
      .setName('limit')
      .setDescription('表示件数（デフォルト: 10）')
      .setMinValue(1)
      .setMaxValue(25)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const limit = interaction.options.getInteger('limit') ?? 10;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: 'サーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  await interaction.deferReply({ ephemeral: true });

  const bookmarks = await getBookmarks(interaction.user.id, guildId, limit);

  if (bookmarks.length === 0) {
    await interaction.editReply(
      'ブックマークがありません。メッセージに ⭐ リアクションを追加するとブックマークできます。'
    );
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle('⭐ あなたのブックマーク')
    .setColor(0xfee75c)
    .setDescription(`${bookmarks.length}件`)
    .setFooter({ text: 'discord-knowledge-bot' });

  for (const bm of bookmarks) {
    const link = buildMessageLink(bm.guild_id, bm.channel_id, bm.id);
    const date = new Date(bm.created_at).toLocaleDateString('ja-JP');
    embed.addFields({
      name: `${bm.author_username} - ${date}`,
      value: `${truncate(bm.content, 150)}\n[メッセージへ](${link})`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
