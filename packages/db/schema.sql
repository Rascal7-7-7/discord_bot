-- discord-knowledge-bot schema
-- PostgreSQL (Neon) 対応

-- guilds: Discordサーバー情報
CREATE TABLE IF NOT EXISTS guilds (
    id VARCHAR(20) PRIMARY KEY,          -- Discord Guild ID (snowflake)
    name VARCHAR(100) NOT NULL,
    icon_url TEXT,
    joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- channels: チャンネル情報
CREATE TABLE IF NOT EXISTS channels (
    id VARCHAR(20) PRIMARY KEY,          -- Discord Channel ID (snowflake)
    guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    name VARCHAR(100) NOT NULL,
    type SMALLINT NOT NULL DEFAULT 0,    -- 0: text, 2: voice, etc.
    is_tracked BOOLEAN NOT NULL DEFAULT FALSE,  -- 保存対象かどうか
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_channels_guild_id ON channels(guild_id);
CREATE INDEX IF NOT EXISTS idx_channels_is_tracked ON channels(is_tracked);

-- messages: メッセージ保存
CREATE TABLE IF NOT EXISTS messages (
    id VARCHAR(20) PRIMARY KEY,          -- Discord Message ID (snowflake)
    channel_id VARCHAR(20) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    author_id VARCHAR(20) NOT NULL,
    author_username VARCHAR(32) NOT NULL,
    content TEXT NOT NULL DEFAULT '',
    attachments JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ NOT NULL,     -- メッセージ作成日時（Discord側）
    edited_at TIMESTAMPTZ,
    saved_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_messages_channel_id ON messages(channel_id);
CREATE INDEX IF NOT EXISTS idx_messages_guild_id ON messages(guild_id);
CREATE INDEX IF NOT EXISTS idx_messages_author_id ON messages(author_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
-- trigram拡張（ILIKE検索の高速化）— インデックス作成前に必要
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_messages_content_trgm ON messages USING gin (content gin_trgm_ops);

-- sync_states: 同期状態管理
CREATE TABLE IF NOT EXISTS sync_states (
    id SERIAL PRIMARY KEY,
    guild_id VARCHAR(20) NOT NULL REFERENCES guilds(id) ON DELETE CASCADE,
    channel_id VARCHAR(20) NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
    last_synced_message_id VARCHAR(20),
    last_synced_at TIMESTAMPTZ,
    status VARCHAR(20) NOT NULL DEFAULT 'idle',  -- idle, syncing, error
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(guild_id, channel_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_states_guild_channel ON sync_states(guild_id, channel_id);
