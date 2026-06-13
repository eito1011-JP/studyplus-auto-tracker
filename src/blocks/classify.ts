import type { TrackerConfig } from "../config.js";

export interface WindowData {
  app: string;
  title: string;
}

/**
 * ウィンドウイベントが計測対象かを判定する（決定 #3）。
 * - エディタ・ターミナル（alwaysCountApps）: app 名一致だけで対象。
 * - ブラウザ（titleGatedApps）: app 名一致 かつ タイトルが開発関連パターンに合致したときだけ対象。
 * - それ以外のアプリ: 対象外。
 * AFK 判定はここでは扱わない（呼び出し側で not-AFK 期間と交差済みの前提）。
 */
export function isCountable(data: WindowData, cfg: TrackerConfig): boolean {
  if (cfg.alwaysCountApps.includes(data.app)) return true;
  if (cfg.titleGatedApps.includes(data.app)) {
    return cfg.devTitlePatterns.some((re) => re.test(data.title));
  }
  return false;
}
