import { ChatInputCommandInteraction, Events, Interaction } from 'discord.js';
import * as help from '../commands/help';
import * as search from '../commands/search';
import * as recent from '../commands/recent';
import * as summary from '../commands/summary';
import * as ask from '../commands/ask';
import * as bookmarks from '../commands/bookmarks';
import * as stats from '../commands/stats';

interface Command {
  data: { name: string };
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
}

const commands = new Map<string, Command>();
commands.set(help.data.name, help);
commands.set(search.data.name, search);
commands.set(recent.data.name, recent);
commands.set(summary.data.name, summary);
commands.set(ask.data.name, ask);
commands.set(bookmarks.data.name, bookmarks);
commands.set(stats.data.name, stats);

export const name = Events.InteractionCreate;

export async function execute(interaction: Interaction): Promise<void> {
  if (!interaction.isChatInputCommand()) return;

  const command = commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`コマンド実行エラー [${interaction.commandName}]:`, error);
    const reply = {
      content: 'コマンドの実行中にエラーが発生しました。',
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(reply);
    } else {
      await interaction.reply(reply);
    }
  }
}
