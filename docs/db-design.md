# データベース設計書

## テーブル一覧

| テーブル名 | 説明 |
|------------|------|
| guilds | Discord サーバー情報 |
| channels | チャンネル情報（保存対象フラグ付き） |
| messages | 保存されたメッセージ |
| sync_states | チャンネルごとの同期状態 |

## ER 図（テキスト）

```
guilds (1) ──── (*) channels
  │                    │
  │                    │
  └──── (*) messages (*) ────┘
  │
  └──── (*) sync_states (*) ── channels
```

## テーブル詳細

### guilds

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | VARCHAR(20) | PK | Discord Guild ID |
| name | VARCHAR(100) | NOT NULL | サーバー名 |
| icon_url | TEXT | | アイコンURL |
| joined_at | TIMESTAMPTZ | DEFAULT NOW() | 参加日時 |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | レコード作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | レコード更新日時 |

### channels

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | VARCHAR(20) | PK | Discord Channel ID |
| guild_id | VARCHAR(20) | FK → guilds | 所属ギルド |
| name | VARCHAR(100) | NOT NULL | チャンネル名 |
| type | SMALLINT | DEFAULT 0 | チャンネル種別 |
| is_tracked | BOOLEAN | DEFAULT FALSE | 保存対象フラグ |
| created_at | TIMESTAMPTZ | DEFAULT NOW() | レコード作成日時 |
| updated_at | TIMESTAMPTZ | DEFAULT NOW() | レコード更新日時 |

### messages

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | VARCHAR(20) | PK | Discord Message ID |
| channel_id | VARCHAR(20) | FK → channels | チャンネル |
| guild_id | VARCHAR(20) | FK → guilds | ギルド |
| author_id | VARCHAR(20) | NOT NULL | 投稿者ID |
| author_username | VARCHAR(32) | NOT NULL | 投稿者名 |
| content | TEXT | DEFAULT '' | メッセージ本文 |
| attachments | JSONB | DEFAULT '[]' | 添付ファイル |
| created_at | TIMESTAMPTZ | NOT NULL | 投稿日時 |
| edited_at | TIMESTAMPTZ | | 編集日時 |
| saved_at | TIMESTAMPTZ | DEFAULT NOW() | 保存日時 |

### sync_states

| カラム | 型 | 制約 | 説明 |
|--------|-----|------|------|
| id | SERIAL | PK | 連番ID |
| guild_id | VARCHAR(20) | FK → guilds | ギルド |
| channel_id | VARCHAR(20) | FK → channels | チャンネル |
| last_synced_message_id | VARCHAR(20) | | 最後に同期したメッセージ |
| last_synced_at | TIMESTAMPTZ | | 最終同期日時 |
| status | VARCHAR(20) | DEFAULT 'idle' | 同期ステータス |
| error_message | TEXT | | エラーメッセージ |

## インデックス

- `idx_channels_guild_id` — channels(guild_id)
- `idx_channels_is_tracked` — channels(is_tracked)
- `idx_messages_channel_id` — messages(channel_id)
- `idx_messages_guild_id` — messages(guild_id)
- `idx_messages_author_id` — messages(author_id)
- `idx_messages_created_at` — messages(created_at DESC)
- `idx_messages_content_trgm` — messages(content) GIN trigram
- `idx_sync_states_guild_channel` — sync_states(guild_id, channel_id)
