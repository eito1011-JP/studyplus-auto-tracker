import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { setToken, getToken } from "./studyplus/keychain.js";
import { StudyPlusApi, AuthError } from "./studyplus/api.js";

// 初回トークンシード（決定 #12・手動）。
// 手順: StudyPlus web にログイン → devtools の Network で任意の api.studyplus.jp リクエストを開き
//       Request Headers の `authorization: OAuth <token>` の <token> をコピー → 本コマンドに貼る。
// 取得したトークンは /me で疎通確認してから macOS Keychain に保管する。

async function main(): Promise<void> {
  const fromEnv = process.env["STUDYPLUS_TOKEN"]?.trim();
  let token = fromEnv ?? "";

  if (!token) {
    const rl = createInterface({ input: stdin, output: stdout });
    token = (await rl.question("StudyPlus アクセストークン（OAuth の後ろの値）を貼り付けて Enter: ")).trim();
    rl.close();
  }

  if (!token) {
    console.error("トークンが空です。中止します。");
    process.exitCode = 1;
    return;
  }

  // 保管前に疎通確認（無効なトークンを保管しないため）。
  try {
    await new StudyPlusApi(token).me();
  } catch (err) {
    if (err instanceof AuthError) {
      console.error("このトークンは無効（401）です。Keychain には保管しませんでした。");
    } else {
      console.error("疎通確認に失敗:", err);
    }
    process.exitCode = 1;
    return;
  }

  await setToken(token);
  const stored = await getToken();
  console.log(stored === token ? "✓ トークンを Keychain に保管しました（/me 疎通OK）。" : "保管の確認に失敗しました。");
}

main().catch((err) => {
  console.error("seed 失敗:", err);
  process.exitCode = 1;
});
