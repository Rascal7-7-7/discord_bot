# discord-knowledge-bot

Discord サーバー内の技術情報・共有情報を蓄積し、検索・要約・再利用できる Bot。
モノレポに **2 つの Bot** が入っている（`bot.md` に機能詳細）:

- **Kura（Bot A）** — 知識収集 & 検索。`apps/kura`（package 名 `discord-knowledge-bot`）
- **Pulse（Bot B）** — AI・テック・マーケティングのトレンドを毎日自動レポート。`apps/pulse`

## Stack

- TypeScript + discord.js v14（Bot core）
- Python + FastAPI（`apps/analysis` — **今後実装予定**）
- PostgreSQL（Neon）
- Google Cloud Run
- Node.js 20+

## Layout

実体は README のディレクトリ図と一致しない。**実際の構成が正**:

```
apps/{kura, pulse, analysis}      # README の図は apps/bot と書いているが存在しない
packages/{db, shared}
infra/{docker, cloud-run}
docs/{commands.md, db-design.md, requirements.md}
```

## Commands

`apps/kura`:

```bash
npm run dev              # tsx watch src/index.ts
npm run build            # tsc
npm start                # node dist/index.js
npm run deploy-commands  # Slash Command 登録
npm run migrate
npm run setup-channels
npm run backfill
```

`apps/pulse`: `dev` / `build` / `start` / `test`（vitest）

DB セットアップ・Docker・Cloud Run デプロイの手順は README を参照。

## Project constraints

- 必要な環境変数は `DATABASE_URL` / `DISCORD_TOKEN` / `CLIENT_ID` / `GUILD_ID`。
  値は `.env`（`.env.example` からコピー）と Cloud Run の Secret Manager に置く。
  **値をコード・ログ・レスポンスへ出さない。**
- `apps/analysis` は未実装。分析・要約の高度化はここに入る予定で、現状は存在しない前提で扱う。
- ルートに package.json は無い。npm コマンドは各 `apps/<name>` ディレクトリで実行する。
