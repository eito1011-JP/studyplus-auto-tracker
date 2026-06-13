import type { TrackerConfig } from "../config.js";
import { isCountable } from "../blocks/classify.js";
import type { Interval } from "../blocks/types.js";

/** ActivityWatch のイベント1件（window バケット）。 */
export interface AwEvent {
  timestamp: string; // ISO8601
  duration: number; // 秒
  data: { app?: string; title?: string };
}

/**
 * not-AFK 期間に交差済みの window イベント列を、計測対象の稼働区間に変換する（純ロジック）。
 * - ホワイトリスト判定（isCountable）を通らないイベントは捨てる。
 * - duration 0 のイベント（瞬間のフォーカス）は区間にならないので捨てる。
 */
export function toCountableIntervals(events: AwEvent[], cfg: TrackerConfig): Interval[] {
  const intervals: Interval[] = [];
  for (const ev of events) {
    if (ev.duration <= 0) continue;
    const app = ev.data.app ?? "";
    const title = ev.data.title ?? "";
    if (!isCountable({ app, title }, cfg)) continue;
    const start = Date.parse(ev.timestamp);
    intervals.push({ start, end: start + ev.duration * 1000 });
  }
  return intervals;
}
