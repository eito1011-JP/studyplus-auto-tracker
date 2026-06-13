import { config } from "./config.js";
import { AwClient } from "./aw/client.js";
import { toCountableIntervals } from "./aw/events.js";
import { blockize, isFinal } from "./blocks/blockize.js";
import { Ledger } from "./ledger/ledger.js";

const LEDGER_PATH = ".state/ledger.json";
const LOOKBACK_MS = 24 * 60 * 60 * 1000; // 直近24時間を走査

function fmt(ms: number): string {
  return new Date(ms).toLocaleString("ja-JP");
}
function mins(sec: number): string {
  return `${Math.round(sec / 60)}分`;
}

/**
 * ポーラー1回ぶん（手動デバッグ用）。
 * AW から稼働を取得 → ブロック化 → 確定ブロックを抽出 → 台帳と照合 → 未投稿を pending 登録。
 * ※ Step 2 では「投稿」はしない。検出と台帳記録までを確認する。
 */
async function main(): Promise<void> {
  const now = Date.now();
  const aw = new AwClient();

  const events = await aw.queryNotAfkWindowEvents(now - LOOKBACK_MS, now);
  const intervals = toCountableIntervals(events, config);
  const blocks = blockize(intervals, { idleGapMs: config.idleGapMs });
  const finalized = blocks.filter((b) => isFinal(b, now, config.finalizeSilenceMs));

  console.log(`AW イベント: ${events.length} 件 / 計測対象区間: ${intervals.length} / ブロック: ${blocks.length}（確定 ${finalized.length}）`);
  for (const b of finalized) {
    console.log(`  確定 ${b.id}: ${fmt(b.start)} 〜 ${fmt(b.end)} 実稼働 ${mins(b.activeSec)}`);
  }

  const ledger = await Ledger.load(LEDGER_PATH);
  const added = ledger.recordPending(finalized);
  await ledger.save();

  console.log(`台帳: 新規 pending ${added.length} 件 / 投稿待ち合計 ${ledger.pending().length} 件`);
  if (ledger.pending().length > 0) {
    console.log("（投稿は Step 3 で実装。現状は検出と台帳記録のみ）");
  }
}

main().catch((err) => {
  console.error("poll 失敗:", err);
  process.exitCode = 1;
});
