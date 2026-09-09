import { REST, Routes } from 'discord.js';
import { config } from '../config/env';
import { data as helpData } from './help';
import { data as searchData } from './search';
import { data as recentData } from './recent';
import { data as summaryData } from './summary';
import { data as askData } from './ask';
import { data as bookmarksData } from './bookmarks';
import { data as statsData } from './stats';

const commands = [
  helpData.toJSON(),
  searchData.toJSON(),
  recentData.toJSON(),
  summaryData.toJSON(),
  askData.toJSON(),
  bookmarksData.toJSON(),
  statsData.toJSON(),
];

const rest = new REST({ version: '10' }).setToken(config.discordToken);

(async () => {
  try {
    console.log(`${commands.length}個のコマンドを登録中...`);
    await rest.put(
      Routes.applicationGuildCommands(config.clientId, config.guildId),
      { body: commands }
    );
    console.log('コマンド登録完了');
  } catch (error) {
    console.error('コマンド登録エラー:', error);
    process.exit(1);
  }
})();
