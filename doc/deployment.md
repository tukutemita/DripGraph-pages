# 起動フロー

## 事前準備

1. `.env` を作成  
   ```bash
   cp .env.example .env
   ```
2. 必要に応じて `ENCRYPTION_SALT` を変更

## Docker 起動

```bash
docker compose up -d --build
# ブラウザで http://localhost:3000 を開く
```

初回起動時のフロー:

1. 依存パッケージのインストール（存在しない場合のみ）
2. `prisma migrate deploy` → 失敗時に `migrate dev --name init` をフォールバック
3. `scripts/seed.ts` を実行し、モック口座とレートを投入 (`.seeded` ファイルで一度きり制御)
4. `NODE_ENV` に応じて `next dev` または `next start` を実行

## 永続化

- SQLite DB はボリューム `db_data:/app/prisma/data` で保持
- DB ファイル `prisma/data/app.db` を直接エクスポートすることでバックアップ可能

## 停止/メンテナンス

```bash
docker compose down          # コンテナ停止（ボリュームは残る）
docker compose logs -f web   # ログ監視
docker compose exec web sh   # コンテナ内で調査
```

## 将来拡張 TODO

- production 用ビルド (`NODE_ENV=production`) での start 実行最適化
- Puppeteer 追加時のヘッドレス依存設定
- Periodic Sync 決済や通知機構のコンテナ化検討
