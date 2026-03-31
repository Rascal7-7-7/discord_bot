import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
} from 'discord.js';
import { getRecentMessages } from '../services/searchService';
import { buildMessageLink, truncate } from '../utils/messageLink';

export const data = new SlashCommandBuilder()
  .setName('recent')
  .setDescription('最近のメッセージを表示します')
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('対象チャンネル（省略時は全チャンネル）')
      .addChannelTypes(ChannelType.GuildText)
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
  const channel = interaction.options.getChannel('channel');
  const limit = interaction.options.getInteger('limit') ?? 10;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: 'サーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const results = await getRecentMessages(
    guildId,
    channel?.id,
    limit
  );

  if (results.length === 0) {
    await interaction.editReply('保存されたメッセージがありません。');
    return;
  }

  const title = channel ? `#${channel.name} の最近のメッセージ` : '最近のメッセージ';
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(0xfee75c)
    .setDescription(`直近 ${results.length} 件`)
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
