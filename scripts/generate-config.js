#!/usr/bin/env node
/**
 * ローカルの .env.local をもとに config.js を生成します。
 *
 * 既存の config.js は上書きされるため、秘匿情報が含まれる場合は
 * 事前にバックアップしておいてください。
 */
const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const envPath = path.join(projectRoot, '.env.local');
const outputPath = path.join(projectRoot, 'config.js');

if (!fs.existsSync(envPath)) {
  console.error('.env.local が見つかりません。まずは環境変数を設定してください。');
  process.exit(1);
}

const rawEnv = fs.readFileSync(envPath, 'utf-8');
const envEntries = rawEnv
  .split(/\r?\n/)
  .map((line) => line.trim())
  .filter((line) => line && !line.startsWith('#'))
  .map((line) => {
    const [key, ...rest] = line.split('=');
    return [key.trim(), rest.join('=').trim()];
  })
  .filter(([key]) => Boolean(key));

const env = Object.fromEntries(envEntries);

const configContent = `// このファイルは scripts/generate-config.js により自動生成されました。
window.GCV_API_KEY = window.GCV_API_KEY || ${JSON.stringify(env.GCV_API_KEY || '')};
window.PERPLEXITY_API_KEY = window.PERPLEXITY_API_KEY || ${JSON.stringify(env.PERPLEXITY_API_KEY || '')};
window.SUPABASE_URL = window.SUPABASE_URL || ${JSON.stringify(env.SUPABASE_URL || '')};
window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || ${JSON.stringify(env.SUPABASE_ANON_KEY || '')};
`;

fs.writeFileSync(outputPath, configContent, { encoding: 'utf-8' });
fs.chmodSync(outputPath, 0o600);

console.log('config.js を更新しました (.env.local の値を反映)。');
