import type { Block, Interval } from "./types.js";

export interface BlockizeOptions {
  /** この隙間未満は同一ブロックに連結、以上で区切る。 */
  idleGapMs: number;
}

/**
 * 稼働区間を時系列にマージしてブロック化する（決定 #4・純ロジック）。
 * 隣接区間の隙間が idleGapMs 未満なら同一ブロックに連結し、以上なら区切る。
 * 重複・順不同の入力も正しく扱う。実稼働秒は重複を除いた実カバー時間。
 */
export function blockize(intervals: Interval[], opts: BlockizeOptions): Block[] {
  if (intervals.length === 0) return [];

  const sorted = [...intervals].sort((a, b) => a.start - b.start);

  const blocks: Block[] = [];
  let curStart = sorted[0]!.start;
  let curEnd = sorted[0]!.end;
  let covered = sorted[0]!.end - sorted[0]!.start; // 重複を除いた実カバー時間（ms）

  const flush = () => {
    blocks.push(makeBlock(curStart, curEnd, covered));
  };

  for (let i = 1; i < sorted.length; i++) {
    const iv = sorted[i]!;
    const gap = iv.start - curEnd;
    if (gap < opts.idleGapMs) {
      // 連結。重複ぶん（curEnd を越えた部分のみ）を実カバーに加算。
      if (iv.end > curEnd) {
        covered += iv.end - Math.max(iv.start, curEnd);
        curEnd = iv.end;
      }
    } else {
      flush();
      curStart = iv.start;
      curEnd = iv.end;
      covered = iv.end - iv.start;
    }
  }
  flush();
  return blocks;
}

function makeBlock(start: number, end: number, coveredMs: number): Block {
  return {
    id: blockId(start),
    start,
    end,
    activeSec: Math.round(coveredMs / 1000),
  };
}

/** start 時刻のみから決定的に導く安定 ID。末尾が伸びても不変。 */
export function blockId(start: number): string {
  return `blk_${start}`;
}

/**
 * ブロックが「確定」（投稿対象）かを判定する。
 * 末尾から finalizeSilenceMs を超えて沈黙していれば、もう伸びないので確定。
 */
export function isFinal(block: Block, nowMs: number, finalizeSilenceMs: number): boolean {
  return nowMs - block.end > finalizeSilenceMs;
}
