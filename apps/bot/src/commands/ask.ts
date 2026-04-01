import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
} from 'discord.js';
import { askWithContext } from '../services/askService';

export const data = new SlashCommandBuilder()
  .setName('ask')
  .setDescription('チャンネルの過去メッセージをもとにAIが質問に回答します')
  .addStringOption((option) =>
    option
      .setName('question')
      .setDescription('質問内容')
      .setRequired(true)
  )
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('参照するチャンネル（省略時: 現在のチャンネル）')
      .addChannelTypes(ChannelType.GuildText)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const question = interaction.options.getString('question', true);
  const channel = interaction.options.getChannel('channel') ?? interaction.channel;
  const guildId = interaction.guildId;

  if (!guildId || !channel) {
    await interaction.reply({ content: 'サーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const answer = await askWithContext(
    guildId,
    channel.id,
    question,
    interaction.user.username
  );

  const embed = new EmbedBuilder()
    .setTitle('💬 AIアシスタントの回答')
    .setColor(0x5865f2)
    .addFields(
      { name: '質問', value: question.slice(0, 256) },
      { name: '回答', value: answer.slice(0, 1024) }
    )
    .setFooter({ text: `参照: #${'name' in channel ? channel.name : channel.id} | discord-knowledge-bot` });

  await interaction.editReply({ embeds: [embed] });
}
