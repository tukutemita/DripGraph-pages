# DripGraph (公開パッケージ)

DripGraph は、証券口座や銀行口座の評価額をローカル環境で一元管理するための Next.js 14 製ダッシュボードです。
Puppeteer を使った手動連携フローと SQLite (Prisma) を組み合わせ、個人で完結する資産モニタリング環境を提供します。

## 主な特徴
- Rakuten 証券 / 楽天銀行 / SBI 証券向けのブラウザ連携コネクタを同梱（Chromium をヘッドフルで起動し、利用者が直接ログイン）
- 手動証券・手動銀行アカウントを登録してオフライン資産も入力可能
- 保有資産の評価額、推移、利益率、現金ポジションをグラフ / カード / テーブルで可視化
- すべてのデータは `prisma/data/app.db`（SQLite）に保存され、外部には送信されません

## 動作要件
- Node.js 20 LTS (18.18 以上でも可)
- npm 10 以上
- 1GB 以上の空き容量（Puppeteer が Chromium をダウンロードするため）

## セットアップ手順
```bash
git clone https://github.com/tukutemita/DripGraph-pages.git DripGraph-pages
cd DripGraph-pages
cp .env.example .env                      # ENCRYPTION_SALT を任意の値に変更
npm install                               # 依存関係と Chromium を取得
npx prisma db push                        # SQLite スキーマを反映
```

- 既存の `prisma/data/app.db` を削除するとクリーンな状態に戻せます。
- サンプルデータは付属しません。`npm run seed` は空の挙動で、動作確認後は不要です。

## 実行方法
- 開発サーバー: `npm run dev` → http://localhost:3000
- 本番ビルド: `npm run build && npm run start` → http://localhost:3000
- Prisma Studio（データ確認）: `npx prisma studio`

## データ同期フロー（概要）
1. ダッシュボード右上の「アカウント連携」から対象の金融機関を選択。
2. Chromium ウィンドウがヘッドフルで起動するので、利用者自身がログインを完了。
3. ログイン後に自動で残高・保有資産を解析し、SQLite に保存。
4. 手動銀行／手動証券を選ぶと、金額を直接入力してスナップショットを登録できます。

> **重要:** 自動ログインやクローラーモードは無効化されています。必ず目視でログインしてください。

## ディレクトリガイド
- `src/app` … Next.js App Router のページ / API
- `src/lib` … Prisma クライアント、各種コネクタ、集計ロジック
- `scripts` … シードや一時的な CLI（`scrape:rakuten` は安全のため無効化済み）
- `prisma` … Prisma スキーマと `data/app.db`
- `doc` … 仕組みやデータモデルの補足資料

## よくある操作
- **DB を初期化したい**: `rm prisma/data/app.db && npx prisma db push`
- **ログを確認したい**: `src/app/api/sync/route.ts` で生成される SyncLog を UI から確認
- **金融機関を追加したい**: `src/config/providers.ts` と各 `src/lib/connectors/*.ts` を参考にコネクタを実装

## ドキュメント
詳細な設計やデータモデルは `doc/` 配下にまとめています（`overview.md`, `data-model.md`, `connectors.md`, `deployment.md` など）。

## ライセンス
利用条件は `LICENSE` を参照してください。
