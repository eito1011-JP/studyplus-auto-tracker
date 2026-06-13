# StudyPlus 自動記録ツール — SPEC

開発時間を ActivityWatch で自動計測し、確定した作業ブロックを StudyPlus API へ自動投稿する個人ツール。
（lexis リポ外の独立プロジェクト。lexis に spec/release を作らない方針）

## 背景・目的

- 開発時間を StudyPlus に記録したいが、手動の「開始ボタン」を押し忘れる／ブラウザのタブに埋もれて押さなくなる。
- 失敗の本質は「記憶依存」と「トリガーが動線から外れている」こと。
- → 稼働を自動計測し、確定した作業ブロックを StudyPlus に自動投稿することで、ボタン操作そのものを消す。

## 全体アーキテクチャ

```
ActivityWatch（計測・AFKでブロックを自動で閉じる）
        │  ローカル REST API
        ▼
ポーラー（数分おき・launchd 常駐）
   ・稼働期間を idle gap でクラスタリング（短い休憩は連結）
   ・確定ブロック（終了後に閾値超の沈黙）を検出
   ・投稿済み台帳と照合 → 未投稿だけ抽出
        │
        ▼
API pusher（直接 HTTP POST・ブラウザ不要）
   ・POST https://api.studyplus.jp/2/study_records
        │
        ▼
通知（失敗時即通知 + 日1回サマリー）
```

本番に Playwright は不要。Playwright は「初回トークン取得」と「偵察」だけに使う。

## 確定事項（dig + 実機偵察）

| # | 項目 | 決定 |
|---|------|------|
| 1 | 計測エンジン | ActivityWatch（自前計測しない） |
| 2 | 投稿手段 | StudyPlus REST API へ直接 HTTP POST |
| 3 | 計測範囲 | エディタ + ターミナル + 開発ブラウザ（window title ホワイトリスト） |
| 4 | ブロック化 | idle gap ≒15分で区切り、15分未満の休憩は同一記録に連結 |
| 5 | 盲点（入力ゼロ時間）対策 | まず素で1日回し、削られ率を実測してから心拍ソース追加を判断 |
| 6 | 教材マッピング | 専用教材「アプリ開発」1つに集約（プロジェクト別は後続） |
| 7 | 記録時刻 | 作業ブロックの実際の開始時刻（`record_datetime` で指定） |
| 8 | ポーラー実行形態 | launchd 常駐、数分おきに AW を覗く |
| 9 | 失敗時 | 未投稿は台帳に pending で残し再試行 + 認証切れは通知 |
| 10 | 二重防止 | 自前台帳 + API の `post_token`（冪等トークン）の二重 |
| 11 | 通知 | 失敗時即通知 + 日1回サマリー（macOS 通知） |
| 12 | トークン取得 | 初回手動シード + 401 時に通知して再シード |
| 13 | 言語 / 置き場所 | Node + TypeScript / `~/project/studyplus-auto-tracker` |

## StudyPlus API 仕様（2026-06-13 実機キャプチャで判明）

> 非公開仕様。web アプリ（Flutter 製）が内部で叩く API v2 を観測したもの。仕様変更・ToS の留意は「リスク」参照。

### 記録の作成

```
POST https://api.studyplus.jp/2/study_records
Headers:
  authorization: OAuth <access_token>
  content-type: application/json; charset=utf-8
  client-service: Studyplus
  stpl-client-sp2: 1
Body (JSON):
  {
    "material_code":     "<教材UUID>",
    "record_datetime":   "2026-06-13T13:41:19.950+09:00",  // ISO8601・任意の過去日時を指定可
    "duration":          60,                                 // 秒単位（1分=60）
    "post_token":        "<冪等UUID>",                       // 同一トークンの再送は重複作成しない
    "comment":           "",
    "study_source_type": "studyplus",
    "runtimeType":       "default"
  }
```

- `record_datetime` が ISO8601（TZ付き）→ **過去日時の登録が可能**（要件 #7 を満たす）。
- `duration` は**秒**。
- `post_token` は client 生成の冪等トークン → **ブロック ID から決定的に UUID を生成**して使えば、再試行時の二重投稿を API 側でも防げる（要件 #10）。

### 補助エンドポイント

- `GET https://api.studyplus.jp/2/book/book_material_entries` … 教材一覧（「アプリ開発」の UUID を解決）
- `GET https://api.studyplus.jp/2/me` … 認証確認（401 でトークン失効を検知）

### 認証

- スキーム: `Authorization: OAuth <token>`（token は UUID 形式のアクセストークン）。
- 取得フロー（web）: Google ログイン → firebase custom token → `POST /2/client_auth` → アクセストークン。
- MVP の取り回し（決定 #12）: 初回だけブラウザでログインしてトークンを抽出 → macOS Keychain に保管。`/2/me` が 401 を返したら通知して再シード。
- **トークン・post_token・台帳・キャプチャした認証情報は git にコミットしない**（`.gitignore` 必須）。

## 計測仕様（ActivityWatch）

- 使用 watcher: `aw-watcher-window`（アクティブアプリ + タイトル）、`aw-watcher-afk`（入力の有無）。
- カウント対象（決定 #3）: アクティブアプリが「エディタ / ターミナル / 開発ブラウザ（GitHub・PR・localhost・技術 docs）」のホワイトリストに合致 **かつ** not-AFK の期間。
- ブロック化（決定 #4）: 対象期間を時系列にマージし、`gap < 15分` は同一ブロック、`gap >= 15分` でブロックを区切る。
- 確定判定: あるブロックの末尾から `15分` 超の沈黙が続いたら「確定」＝投稿対象。
- 教材: ブロックは全て「アプリ開発」教材に紐づける（UUID は起動時に `book_material_entries` で解決しキャッシュ）。

## 投稿仕様（pusher）

- ポーラーが確定ブロックを検出 → 投稿済み台帳（block ID）と照合 → 未投稿のみ POST。
- マッピング: `record_datetime` = ブロック開始時刻、`duration` = ブロックの実稼働秒、`material_code` = アプリ開発 UUID、`post_token` = `uuidv5(block_id)`。
- 成功 → 台帳に done で記録。失敗 → pending で残し次回再試行。401 → 通知して再シード。

## ビルド順（リスクの高い順に潰す）

- **Step 0（完了）** Playwright で StudyPlus 偵察 → 教材作成可・過去日時/分数指定可・API 仕様確定。
- **Step 1** ActivityWatch 導入 + ローカル API から稼働データが引けるか確認（同時に「入力ゼロで削られる率」を実測 → 決定 #5 の判断材料）。
- **Step 2** ポーラー + 台帳 + ブロック化ロジック（純ロジック中心、ユニットテストしやすい）。
- **Step 3** API pusher + 初回トークンシード + launchd 常駐 + 通知。

## スコープ外（MVP では割り切り）

- プロジェクト別の教材分割（決定 #6 の将来拡張。window title からの推定が要る）。
- 複数マシン対応（AW はデバイス単位。MVP はメイン Mac 1台前提）。
- 入力ゼロ時間の心拍ソース追加（git commit / Claude Code / GitHub タブ等。実測してから判断）。

## リスク要因

- **トークン寿命が未知**: UUID アクセストークンが何日生きるか不明。Step 3 でシード後に実測し、短命なら再シード頻度を見直す。
- **AW カウント範囲のチューニング**: ホワイトリストの過不足は1日実測で調整。
- **StudyPlus API は非公開仕様**: 予告なく変わりうる。ToS 上も個人の私的利用に留め、高頻度・大量アクセスはしない（ポーラーは数分間隔・1ブロック1リクエスト）。
- **idle 閾値の妥当性**: 15分は仮。実測で休憩の混入／作業の分断を見て調整。
