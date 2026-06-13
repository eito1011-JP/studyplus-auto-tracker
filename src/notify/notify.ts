import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// macOS 通知（決定 #11）。osascript の display notification を使う（追加依存なし）。
async function display(title: string, message: string): Promise<void> {
  const escape = (s: string) => s.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  const script = `display notification "${escape(message)}" with title "${escape(title)}"`;
  try {
    await exec("osascript", ["-e", script]);
  } catch {
    // 通知失敗そのものでツールを止めない（最悪ログに出ていればよい）。
    console.error("通知失敗:", title, message);
  }
}

export function notifyError(message: string): Promise<void> {
  return display("StudyPlus 記録ツール — 失敗", message);
}

export function notifyReseed(): Promise<void> {
  return display("StudyPlus 記録ツール — 再ログインが必要", "トークンが失効しました。`npm run seed` で再シードしてください。");
}

export function notifySummary(message: string): Promise<void> {
  return display("StudyPlus 記録ツール — 本日のサマリー", message);
}
