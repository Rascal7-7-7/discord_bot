/**
 * migrate.ts
 * packages/db/schema.sql をDBに適用するスクリプト
 *
 * 使い方: npm run migrate
 */

import fs from 'fs';
import path from 'path';
import { pool } from '../db/pool';

async function migrate(): Promise<void> {
  const schemaPath = path.resolve(__dirname, '../../../../packages/db/schema.sql');
  const sql = fs.readFileSync(schemaPath, 'utf-8');

  console.log('スキーマを適用中...');
  await pool.query(sql);
  console.log('スキーマ適用完了');

  await pool.end();
}

migrate().catch((error) => {
  console.error('マイグレーションエラー:', error);
  process.exit(1);
});
