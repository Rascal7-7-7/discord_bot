import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
  ChannelType,
} from 'discord.js';
import { getChannelStats } from '../services/statsService';

export const data = new SlashCommandBuilder()
  .setName('stats')
  .setDescription('チャンネルの活動統計を表示します')
  .addChannelOption((option) =>
    option
      .setName('channel')
      .setDescription('対象チャンネル')
      .addChannelTypes(ChannelType.GuildText)
      .setRequired(true)
  )
  .addIntegerOption((option) =>
    option
      .setName('days')
      .setDescription('集計期間（日）デフォルト: 30')
      .setMinValue(1)
      .setMaxValue(365)
  );

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const channel = interaction.options.getChannel('channel', true);
  const days = interaction.options.getInteger('days') ?? 30;
  const guildId = interaction.guildId;

  if (!guildId) {
    await interaction.reply({ content: 'サーバー内でのみ使用できます。', ephemeral: true });
    return;
  }

  await interaction.deferReply();

  const stats = await getChannelStats(guildId, channel.id, days);

  if (stats.totalMessages === 0) {
    await interaction.editReply(
      `#${channel.name} に直近${days}日間の保存済みメッセージはありません。`
    );
    return;
  }

  const channelName = channel.name;
  const embed = new EmbedBuilder()
    .setTitle(`📊 #${channelName} の統計（過去${days}日間）`)
    .setColor(0x3498db)
    .addFields(
      { name: 'メッセージ数', value: `${stats.totalMessages}件`, inline: true },
      { name: 'ユニークユーザー', value: `${stats.uniqueAuthors}人`, inline: true },
      {
        name: '投稿者ランキング',
        value:
          stats.topAuthors
            .map((a, i) => `${i + 1}. **${a.username}**: ${a.count}件`)
            .join('\n') || 'なし',
      },
      {
        name: '時間帯分布（JST・上位8時間）',
        value: buildHourlyChart(stats.hourlyDistribution),
      }
    )
    .setFooter({ text: 'discord-knowledge-bot' });

  await interaction.editReply({ embeds: [embed] });
}

function buildHourlyChart(distribution: { hour: number; count: number }[]): string {
  if (distribution.length === 0) return 'データなし';

  const maxCount = Math.max(...distribution.map((d) => d.count));
  const BAR_WIDTH = 10;

  return [...distribution]
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)
    .sort((a, b) => a.hour - b.hour)
    .map(({ hour, count }) => {
      const filled = Math.round((count / maxCount) * BAR_WIDTH);
      const bar = '█'.repeat(filled) + '░'.repeat(BAR_WIDTH - filled);
      return `\`${String(hour).padStart(2, '0')}時 ${bar} ${count}\``;
    })
    .join('\n');
}
