// ブロック化ロジックの純粋データ型。時刻はすべて epoch ミリ秒で扱う。

/** 計測対象とみなされた稼働区間（not-AFK ∩ ホワイトリスト合致）。 */
export interface Interval {
  start: number; // epoch ms
  end: number; // epoch ms（start <= end）
}

/** 隙間 < idleGap で連結された作業ブロック。 */
export interface Block {
  /** start 時刻から決定的に導く安定 ID（再試行・台帳照合・post_token 生成に使う）。 */
  id: string;
  start: number; // ブロック先頭の稼働開始（epoch ms）
  end: number; // ブロック末尾の稼働終了（epoch ms）
  /** 実稼働秒（連結した各区間の長さの合計。連結された休憩は含まない。SPEC 投稿仕様）。 */
  activeSec: number;
}
