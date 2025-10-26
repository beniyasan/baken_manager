# keiba-ocr v1.0.0

ブラウザ上で馬券画像をOCRし、レース情報や収支を記録・可視化できるシングルページアプリケーションです。  
Supabase をバックエンドに採用し、ユーザ単位での認証とデータ永続化を実現しています。

## 主な機能
- 競馬馬券画像のアップロード（ドラッグ＆ドロップ／クリップボード貼り付け対応）と OCR 実行
- 買い目・払戻などの入力フォーム、および回収率の自動計算
- 登録データの一覧表示、編集・削除、統計集計とグラフ描画
- Supabase Authentication によるメール／パスワード認証（サインアップ／ログイン／パスワード再設定）
- Supabase Postgres を用いたユーザ別データ永続化（Row Level Security 適用）

## 構成
- **フロントエンド**: プレーン HTML / CSS / JavaScript (SPA)
- **OCR**: Google Cloud Vision API（`config.js` でキー設定）
- **補助解析**: Perplexity API（任意・`config.js` でキー設定）
- **バックエンド**: Supabase（Auth, Postgres, Storage ※画像は現在 Postgres TEXT）

## セットアップ
1. 依存ライブラリは無く、静的ホスティングで稼働します。リポジトリをクローンし、このディレクトリを任意の静的サーバで配信してください。
2. `.env.example` をコピーして `.env.local` を作成し、Supabase などの環境変数を設定します。
   ```bash
   cp .env.example .env.local
   ```
3. `.env.local` を元に `config.js` を生成します。
   ```bash
   node scripts/generate-config.js
   ```
4. Supabase CLI が利用可能な環境では、以下でマイグレーションを適用してください。
   ```bash
   supabase db push
   ```
5. `index.html` をブラウザで開き、開発中は `http://localhost` など HTTP(S) ドメインで動作確認します。

## 環境変数（抜粋）
| 変数名 | 用途 |
| --- | --- |
| `SUPABASE_URL` | Supabase プロジェクト URL |
| `SUPABASE_ANON_KEY` | Supabase anon キー（フロントエンド用） |
| `SUPABASE_SERVICE_ROLE_KEY` | サーバ側で必要な場合のみ利用 |
| `GCV_API_KEY` | Google Cloud Vision API キー |
| `PERPLEXITY_API_KEY` | Perplexity API キー（任意機能用） |

## 認証とデータ永続化
- サインアップ／ログイン／ログアウト／パスワード再設定がモーダル UI で利用可能です。
- ログインしていない場合、アプリ本体は表示されず、ログイン誘導画面のみ表示されます。
- ログイン後、`bets` テーブルにユーザ単位のデータが保存されます。画像は Base64 文字列として `image_data` 列に格納されます。
- 未ログイン／Supabase 未接続時は、ページ内の仮データ（サンプル）による動作となります。

## 今後の検討事項
- 画像データを Supabase Storage 等へ保存し、Postgres 側には参照 URL を保持する方式への移行
- パスワード再設定完了後の新パスワード入力 UI の実装
- Supabase Functions / Edge Functions を活用した集計の事前計算や通知機能

## ライセンス
現時点でライセンスは未設定です。必要に応じて追加してください。
