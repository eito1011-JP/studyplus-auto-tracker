import type { Ledger } from "./ledger/ledger.js";
import { AuthError, type StudyRecordInput } from "./studyplus/api.js";
import { postTokenFor } from "./studyplus/posttoken.js";

/** 投稿だけを担う最小インターフェース（テストで差し替え可能にする）。 */
export interface RecordPoster {
  postRecord(input: StudyRecordInput): Promise<void>;
}

export interface PushResult {
  posted: number;
  failed: number;
  /** 401 を踏んだ（トークン失効）。途中で打ち切る。 */
  authFailed: boolean;
}

/**
 * 台帳の pending を順に投稿する。
 * - 成功 → done。失敗 → pending のまま attempts 加算。
 * - 401(AuthError) → トークンが死んでいるので即打ち切り（残りは次回再シード後に再試行）。
 */
export async function pushPending(
  ledger: Ledger,
  poster: RecordPoster,
  materialCode: string,
  nowMs: number,
): Promise<PushResult> {
  const result: PushResult = { posted: 0, failed: 0, authFailed: false };
  for (const entry of ledger.pending()) {
    try {
      await poster.postRecord({
        materialCode,
        startMs: entry.start,
        durationSec: entry.activeSec,
        postToken: postTokenFor(entry.id),
      });
      ledger.markDone(entry.id, nowMs);
      result.posted += 1;
    } catch (err) {
      if (err instanceof AuthError) {
        result.authFailed = true;
        break;
      }
      ledger.markFailed(entry.id);
      result.failed += 1;
    }
  }
  return result;
}
