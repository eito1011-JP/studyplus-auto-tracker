# CLAUDE.md

StudyPlus 自動記録ツールの開発ガイド（Claude Code 用）。
**設計の正本は [`SPEC.md`](./SPEC.md)。実装前に必ず読むこと。**

## このプロジェクトは何か

開発時間を ActivityWatch で自動計測し、確定した作業ブロックを StudyPlus REST API へ
直接 HTTP POST で自動投稿する**個人ツール**。「StudyPlus の開始ボタンを押し忘れる／
タブに埋もれる」問題を、ボタン操作を消すことで解決する。

- lexis リポとは無関係の独立プロジェクト。lexis の規約・フック・メモリは持ち込まない。
- 本番に Playwright は不要（投稿はブラウザレスの HTTP POST）。Playwright は初回トークン取得と偵察のみ。

## 技術スタック

- **Node + TypeScript**
- HTTP: 標準 `fetch`（または軽量クライアント）
- 常駐: macOS `launchd`
- 計測: ActivityWatch（ローカル REST API `http://localhost:5600`）
- 初回トークンシードのみ Playwright

## アーキテクチャ

```
ActivityWatch（計測）→ ポーラー（ブロック化・台帳）→ API pusher（HTTP POST）→ 通知
```

詳細・データフロー・各仕様は SPEC.md を参照。

## StudyPlus API 要点（再偵察不要・SPEC.md に全文）

```
POST https://api.studyplus.jp/2/study_records
Headers: authorization: OAuth <token> / content-type: application/json
         client-service: Studyplus / stpl-client-sp2: 1
Body: { material_code, record_datetime(ISO8601,過去日時可), duration(秒),
        post_token(冪等UUID), comment, study_source_type:"studyplus", runtimeType:"default" }
```

- `GET /2/book/book_material_entries` … 教材一覧（「アプリ開発」の UUID 解決）
- `GET /2/me` … 認証確認（401 で失効検知）
- `duration` は**秒**。`post_token` は**冪等トークン**＝二重投稿防止に使う。

## ビルド順（SPEC.md 準拠）

- **Step 0**（完了）偵察で API 仕様確定。
- **Step 1** ActivityWatch 導入 + ローカル API から稼働データ取得を確認（入力ゼロで削られる率も実測）。
- **Step 2** ポーラー + 台帳 + ブロック化ロジック（純ロジック、ユニットテスト中心）。
- **Step 3** API pusher + 初回トークンシード + launchd 常駐 + 通知。

スコープ外（MVP では割り切り）: プロジェクト別教材分割 / 複数マシン / 入力ゼロ時間の心拍補完。

## ガードレール（必須）

- **トークン・台帳・認証情報を絶対にコミットしない**（`.gitignore` 済み。`.secrets/` `.state/` `*.token` 等）。
- **StudyPlus API は非公開仕様**。個人の私的利用に留め、高頻度・大量アクセスをしない（ポーラーは数分間隔・1ブロック1リクエスト）。
- **過剰な防御コードを書かない**。仕様上起きないケースへの握りつぶしは禁止（バグを隠す）。
- **TDD**: Step 2 のブロック化ロジックなど純ロジックはテストファーストで書く。

## 開発方針

- AI 生成テキスト（コメント・コミット・説明）は**日本語**。コードコメントは最小限で WHY のみ。
- 実装は SPEC.md の決定事項に従い、スコープ外に手を広げない。曖昧点は確認する。

## コマンド

```bash
npm install        # 依存インストール（dev: vitest / tsx / typescript）
npm test           # ユニットテスト（vitest）
npm run typecheck  # 型チェック（tsc --noEmit）
npm run poll       # ポーラーを1回実行（手動デバッグ。Step 2 時点では検出と台帳記録のみ・投稿なし）
# npm run seed     # 初回トークンシード（Step 3 で実装。Playwright でログイン→Keychain 保管）
```

## ソース構成（Step 2 時点）

- `src/config.ts` … ホワイトリスト（対象アプリ・開発タイトル正規表現）と閾値（idleGap / finalizeSilence = 各15分）。
- `src/aw/client.ts` … AW ローカル API。bucket は型で動的解決。AQL で not-AFK ∩ window を取得。
- `src/aw/events.ts` … AW イベント → 計測対象区間（純ロジック・テスト有）。
- `src/blocks/classify.ts` … ホワイトリスト判定（純ロジック・テスト有）。
- `src/blocks/blockize.ts` … 区間→ブロック連結（隙間<15分）と確定判定（純ロジック・テスト有）。block ID は start から決定的。
- `src/ledger/ledger.ts` … 投稿済み台帳（`.state/ledger.json`・git 管理外）。
- `src/poll.ts` … 上記を束ねる1回ぶんのポーラー。
