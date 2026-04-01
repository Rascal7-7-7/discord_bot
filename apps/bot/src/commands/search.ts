import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';
import { searchMessages } from '../services/searchService';
import { searchByTag, searchByTagAndKeywords } from '../services/tagService';
import { buildMessageLink, truncate } from '../utils/messageLink';

export const data = new SlashCommandBuilder()
  .setName('search')
  .setDescription('キーワードまたはタグでメッセージを検索します')
  .addStringOption((option) =>
    option
      .setName('query')
      .setDescription('検索キーワード（スペース区切りでAND検索）')
      .setRequired(true)
  )
  .addStringOption((option) =>
    option
      .setName('tag')
      .setDescription('タグで絞り込み（例: typescript）')
  )
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
  const query = interaction.options.getString('query', true);
  const tag = interaction.options.getString('tag') ?? null;
  const limit = interaction.options.getInteger('limit') ?? 10;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: 'サーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const keywords = query.split(/\s+/).filter((k) => k.length > 0);
  if (keywords.length === 0 && !tag) {
    await interaction.editReply('検索キーワードまたはタグを入力してください。');
    return;
  }

  const results = tag
    ? keywords.length > 0
      ? await searchByTagAndKeywords(guildId, tag, keywords, limit)
      : await searchByTag(guildId, tag, limit)
    : await searchMessages(guildId, keywords, limit);

  const titleParts = [query && `"${query}"`, tag && `#${tag}`].filter(Boolean).join(' + ');

  if (results.length === 0) {
    await interaction.editReply(`${titleParts} に一致するメッセージが見つかりませんでした。`);
    return;
  }

  const embed = new EmbedBuilder()
    .setTitle(`検索結果: ${titleParts}`)
    .setColor(0x57f287)
    .setDescription(`${results.length}件のメッセージが見つかりました`)
    .setFooter({ text: 'discord-knowledge-bot' });

  for (const msg of results) {
    const link = buildMessageLink(msg.guild_id, msg.channel_id, msg.id);
    const date = new Date(msg.created_at).toLocaleDateString('ja-JP');
    embed.addFields({
      name: `${msg.author_username} - ${date}`,
      value: `${truncate(msg.content, 150)}\n[メッセージへ](${link})`,
    });
  }

  await interaction.editReply({ embeds: [embed] });
}
