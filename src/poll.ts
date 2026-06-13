import { config } from "./config.js";
import { AwClient } from "./aw/client.js";
import { toCountableIntervals } from "./aw/events.js";
import { blockize, isFinal } from "./blocks/blockize.js";
import { Ledger } from "./ledger/ledger.js";
import { loadState, saveState } from "./state.js";
import { getToken } from "./studyplus/keychain.js";
import { StudyPlusApi, AuthError } from "./studyplus/api.js";
import { pushPending } from "./pusher.js";
import { notifyError, notifyReseed, notifySummary } from "./notify/notify.js";

const LEDGER_PATH = ".state/ledger.json";
const LOOKBACK_MS = 24 * 60 * 60 * 1000;

const mins = (sec: number) => `${Math.round(sec / 60)}分`;
const fmt = (ms: number) => new Date(ms).toLocaleString("ja-JP");
const jstDate = (ms: number) => new Date(ms + 9 * 60 * 60 * 1000).toISOString().slice(0, 10);

/**
 * ポーラー1回ぶん（launchd から数分おきに呼ばれる）。
 * AW から稼働取得 → ブロック化 → 確定ブロックを台帳に pending 登録 → StudyPlus へ投稿。
 */
async function runOnce(): Promise<void> {
  const now = Date.now();

  // 1) 稼働 → 確定ブロック
  const aw = new AwClient();
  const events = await aw.queryNotAfkWindowEvents(now - LOOKBACK_MS, now);
  const intervals = toCountableIntervals(events, config);
  const blocks = blockize(intervals, { idleGapMs: config.idleGapMs });
  const finalized = blocks.filter((b) => isFinal(b, now, config.finalizeSilenceMs));

  // 2) 台帳へ未投稿を登録
  const ledger = await Ledger.load(LEDGER_PATH);
  const added = ledger.recordPending(finalized);
  console.log(`確定ブロック ${finalized.length} / 新規 pending ${added.length} / 投稿待ち ${ledger.pending().length}`);

  // 3) トークン確認（未シードなら投稿せず終了）
  const token = await getToken();
  if (!token) {
    await ledger.save();
    console.log("トークン未シード。`npm run seed` を実行してください。投稿はスキップ。");
    return;
  }

  // 4) 認証確認 → 教材コード解決（キャッシュ）
  const api = new StudyPlusApi(token);
  const state = await loadState();
  try {
    await api.me();
    if (!state.materialCode) {
      const code = await api.findMaterialCode(config.materialName);
      if (!code) throw new Error(`教材「${config.materialName}」が見つかりません。`);
      state.materialCode = code;
      await saveState(state);
    }
  } catch (err) {
    await ledger.save();
    if (err instanceof AuthError) {
      await notifyReseed();
      console.error("401: トークン失効。再シードが必要。");
    } else {
      await notifyError(`初期化失敗: ${(err as Error).message}`);
      console.error(err);
    }
    return;
  }

  // 5) 投稿
  const result = await pushPending(ledger, api, state.materialCode!, now);
  await ledger.save();
  console.log(`投稿: 成功 ${result.posted} / 失敗 ${result.failed}`);

  if (result.authFailed) await notifyReseed();
  else if (result.failed > 0) await notifyError(`${result.failed} 件の投稿に失敗（次回再試行）。`);

  // 6) 日次サマリー（1日1回）
  const today = jstDate(now);
  if (state.lastSummaryDate !== today) {
    const todayDone = ledger.done().filter((e) => e.postedAt && jstDate(e.postedAt) === today);
    if (todayDone.length > 0) {
      const totalSec = todayDone.reduce((s, e) => s + e.activeSec, 0);
      await notifySummary(`本日 ${todayDone.length} ブロック / 計 ${mins(totalSec)} を記録しました。`);
    }
    state.lastSummaryDate = today;
    await saveState(state);
  }
}

runOnce().catch(async (err) => {
  console.error("poll 失敗:", err);
  await notifyError(`ポーラーが異常終了: ${(err as Error).message}`);
  process.exitCode = 1;
});
