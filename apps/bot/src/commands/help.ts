import {
  ChatInputCommandInteraction,
  EmbedBuilder,
  SlashCommandBuilder,
} from 'discord.js';

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Botの使い方を表示します');

export async function execute(
  interaction: ChatInputCommandInteraction
): Promise<void> {
  const embed = new EmbedBuilder()
    .setTitle('Knowledge Bot - ヘルプ')
    .setColor(0x5865f2)
    .setDescription('サーバー内の技術情報を検索・閲覧できるBotです。')
    .addFields(
      {
        name: '/search <キーワード>',
        value:
          'メッセージをキーワード検索します。スペース区切りでAND検索が可能です。',
      },
      {
        name: '/recent [channel] [limit]',
        value: '最近のメッセージを表示します。チャンネル指定も可能です。',
      },
      {
        name: '/summary <channel> [limit]',
        value: '指定チャンネルの直近メッセージを簡易要約します。',
      },
      {
        name: '/help',
        value: 'このヘルプを表示します。',
      }
    )
    .setFooter({ text: 'discord-knowledge-bot' });

  await interaction.reply({ embeds: [embed] });
}
