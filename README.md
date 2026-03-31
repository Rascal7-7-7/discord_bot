# discord-knowledge-bot

Discord サーバー内の技術情報・共有情報を蓄積し、検索・要約・再利用できる Bot。

## 技術スタック

- **Bot Core**: TypeScript + discord.js v14
- **Analysis Service**: Python + FastAPI（今後実装予定）
- **Database**: PostgreSQL（Neon）
- **Hosting**: Google Cloud Run
- **構成**: モノレポ

## セットアップ

### 前提条件

- Node.js 20+
- Discord Bot Token（[Discord Developer Portal](https://discord.com/developers/applications) で作成）
- Neon PostgreSQL データベース

### 1. リポジトリのクローンと依存関係のインストール

```bash
git clone <repository-url>
cd discord-knowledge-bot
cp .env.example .env
# .env を編集して各値を設定

cd apps/bot
npm install
```

### 2. データベースのセットアップ

Neon コンソールまたは `psql` で `packages/db/schema.sql` を実行:

```bash
psql $DATABASE_URL -f packages/db/schema.sql
```

開発用データを投入する場合:

```bash
psql $DATABASE_URL -f packages/db/seed.sql
```

### 3. Slash Command の登録

```bash
cd apps/bot
npm run deploy-commands
```

### 4. Bot の起動

```bash
# 開発モード（ホットリロード）
npm run dev

# プロダクション
npm run build
npm start
```

## 環境変数

| 変数名 | 説明 |
|--------|------|
| `DATABASE_URL` | Neon PostgreSQL 接続文字列 |
| `DISCORD_TOKEN` | Discord Bot トークン |
| `CLIENT_ID` | Discord Application の Client ID |
| `GUILD_ID` | 対象の Discord サーバー ID |

## コマンド一覧

| コマンド | 説明 |
|----------|------|
| `/search <query>` | キーワードで AND 検索 |
| `/recent [channel] [limit]` | 最近のメッセージ一覧 |
| `/summary <channel> [limit]` | チャンネルの簡易要約 |
| `/help` | ヘルプ表示 |

## Docker（ローカル開発）

```bash
cd infra/docker
docker compose up --build
```

## Cloud Run デプロイ

### Bot サービス

```bash
# イメージをビルド & プッシュ
gcloud builds submit apps/bot \
  --tag gcr.io/PROJECT_ID/discord-knowledge-bot

# Secret Manager に環境変数を登録
gcloud secrets create DATABASE_URL --data-file=-
gcloud secrets create DISCORD_TOKEN --data-file=-
gcloud secrets create CLIENT_ID --data-file=-
gcloud secrets create GUILD_ID --data-file=-

# デプロイ
gcloud run services replace infra/cloud-run/bot-service.yaml
```

### Analysis サービス

```bash
gcloud builds submit apps/analysis \
  --tag gcr.io/PROJECT_ID/knowledge-bot-analysis

gcloud run services replace infra/cloud-run/analysis-service.yaml
```

## ディレクトリ構成

```
discord-knowledge-bot/
├── apps/
│   ├── bot/          # Discord Bot（TypeScript）
│   └── analysis/     # 分析サービス（Python, 今後実装）
├── packages/
│   ├── db/           # SQL スキーマ・マイグレーション
│   └── shared/       # 共有型定義・定数
├── infra/
│   ├── docker/       # docker-compose
│   └── cloud-run/    # Cloud Run 設定
└── docs/             # 設計ドキュメント
```

## 今後の拡張予定

- 過去メッセージの一括同期機能
- チャンネル自動追跡設定（`/track` コマンド）
- Analysis サービスによる高度な要約
- スレッド対応
- 添付ファイル・画像の検索対応
