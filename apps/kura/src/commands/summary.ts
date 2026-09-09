import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
} from 'discord.js';
import { getMessagesForSummary } from '../services/searchService';

export const data = new SlashCommandBuilder()
  .setName('summary')
  .setDescription('チャンネルの直近メッセージを簡易要約します')
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('要約対象のチャンネル')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('limit')
      .setDescription('対象メッセージ数（デフォルト: 30）')
      .setMinValue(5)
      .setMaxValue(100)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const channel = interaction.options.getChannel('channel', true);
  const limit = interaction.options.getInteger('limit') ?? 30;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: 'サーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const messages = await getMessagesForSummary(guildId, channel.id, limit);

  if (messages.length === 0) {
    await interaction.editReply('対象チャンネルに保存されたメッセージがありません。');
    return;
  }

  // 簡易要約: ユーザー別の発言数と頻出キーワード
  const userCounts = new Map<string, number>();
  const wordFreq = new Map<string, number>();

  for (const msg of messages) {
    userCounts.set(
      msg.author_username,
      (userCounts.get(msg.author_username) ?? 0) + 1
    );

    // 簡易的な単語カウント（3文字以上）
    const words = msg.content
      .replace(/[^\w\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]+/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length >= 3);
    for (const word of words) {
      wordFreq.set(word, (wordFreq.get(word) ?? 0) + 1);
    }
  }

  // 上位の投稿者
  const topUsers = [...userCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([name, count]) => `**${name}**: ${count}件`)
    .join('\n');

  // 頻出ワード上位10
  const topWords = [...wordFreq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word, count]) => `\`${word}\` (${count})`)
    .join(', ');

  const oldest = new Date(
    messages[messages.length - 1].created_at
  ).toLocaleDateString('ja-JP');
  const newest = new Date(messages[0].created_at).toLocaleDateString('ja-JP');

  const embed = new EmbedBuilder()
    .setTitle(`#${channel.name} の簡易要約`)
    .setColor(0xeb459e)
    .addFields(
      { name: '期間', value: `${oldest} 〜 ${newest}`, inline: true },
      { name: 'メッセージ数', value: `${messages.length}件`, inline: true },
      { name: 'アクティブユーザー', value: topUsers || 'なし' },
      { name: '頻出ワード', value: topWords || 'なし' }
    )
    .setFooter({ text: 'discord-knowledge-bot' });

  await interaction.editReply({ embeds: [embed] });
}
