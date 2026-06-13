import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";

// 台帳とは別の軽い永続状態（教材コードのキャッシュ、サマリー送信日など）。
// .state/ 配下・git 管理外。
export interface AppState {
  materialCode?: string;
  /** 最後に日次サマリーを送った日付（YYYY-MM-DD, JST）。重複送信防止用。 */
  lastSummaryDate?: string;
}

const STATE_PATH = ".state/app.json";

export async function loadState(path: string = STATE_PATH): Promise<AppState> {
  try {
    return JSON.parse(await readFile(path, "utf8")) as AppState;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    return {};
  }
}

export async function saveState(state: AppState, path: string = STATE_PATH): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(state, null, 2), "utf8");
}
