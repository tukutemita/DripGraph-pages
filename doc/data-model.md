# データモデル一覧

## Account テーブル

| 変数名 | 型 | 日本語名 | 意味 |
| --- | --- | --- | --- |
| id | String | 口座ID | 口座を一意に識別する cuid |
| name | String | 口座名 | UI 上で表示する口座の名称 |
| provider | String | 提供元 | 楽天/SBI/米株API などの種別 |
| method | String | 取得方式 | `api` / `session` / `scrape` 等の識別子 |
| credentialRef | String? | 認証情報参照 | `EncryptedSecret` の ID |
| currency | String | 基軸通貨 | 口座が採用する基軸通貨（JPY/USD 等） |
| createdAt | DateTime | 作成日時 | レコード作成時刻 |
| updatedAt | DateTime | 更新日時 | レコード更新時刻 |

## Holding テーブル

| 変数名 | 型 | 日本語名 | 意味 |
| --- | --- | --- | --- |
| id | String | 保有資産ID | 保有資産レコードの cuid |
| accountId | String | 口座ID | 紐づく口座の ID |
| symbol | String | シンボル | ティッカーや銘柄識別子 |
| name | String | 銘柄名 | 表示用銘柄名称 |
| quantity | Float | 保有数量 | 銘柄の保有数量 |
| avgPrice | Float? | 平均取得価格 | 口座通貨での平均取得単価 |
| costAmount | Float? | 取得総額 | 口座通貨での累計取得額 |
| marketValue | Float | 評価額 | 最新評価額（口座通貨） |
| currency | String | 銘柄通貨 | 銘柄の評価通貨 |
| lastSyncedAt | DateTime | 最終同期日時 | 直近同期のタイムスタンプ |

## RateSnapshot テーブル

| 変数名 | 型 | 日本語名 | 意味 |
| --- | --- | --- | --- |
| id | String | レートID | レートスナップショットの cuid |
| base | String | 基軸通貨 | 換算元通貨（例: USD） |
| quote | String | 参照通貨 | 換算先通貨（例: JPY） |
| rate | Float | 為替レート | `quote` に対する換算レート |
| takenAt | DateTime | 取得日時 | レート取得時刻 |

## EncryptedSecret テーブル

| 変数名 | 型 | 日本語名 | 意味 |
| --- | --- | --- | --- |
| id | String | シークレットID | 暗号化情報を識別する cuid |
| name | String | シークレット名 | 情報内容の識別子 |
| payload | String | 暗号化ペイロード | AES-GCM で暗号化した JSON 文字列 |
| createdAt | DateTime | 登録日時 | レコード作成時刻 |

## SyncLog テーブル

| 変数名 | 型 | 日本語名 | 意味 |
| --- | --- | --- | --- |
| id | String | ログID | ログレコードの cuid |
| accountId | String? | 口座ID | 関連する口座 ID（任意） |
| level | String | ログレベル | info / warn / error など |
| message | String | メッセージ | ログ本文 |
| createdAt | DateTime | 記録日時 | ログ生成時刻 |
