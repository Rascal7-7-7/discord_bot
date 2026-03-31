-- seed.sql: 開発用初期データ
-- 実行前にschema.sqlを適用してください

-- サンプルギルド
INSERT INTO guilds (id, name) VALUES
    ('000000000000000001', 'テスト開発サーバー')
ON CONFLICT (id) DO NOTHING;

-- サンプルチャンネル
INSERT INTO channels (id, guild_id, name, type, is_tracked) VALUES
    ('000000000000000101', '000000000000000001', 'general', 0, TRUE),
    ('000000000000000102', '000000000000000001', 'tech-share', 0, TRUE),
    ('000000000000000103', '000000000000000001', 'random', 0, FALSE)
ON CONFLICT (id) DO NOTHING;
