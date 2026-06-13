import { chromium } from "playwright";
import { setToken, getToken } from "./studyplus/keychain.js";
import { StudyPlusApi, AuthError } from "./studyplus/api.js";

// Playwright 版の初回トークンシード。
// システムの Chrome を開き、ユーザーが StudyPlus にログインしたら、
// api.studyplus.jp 宛リクエストの `authorization: OAuth <token>` を自動キャプチャして保管する。
// ログイン操作はユーザー自身が行う（パスワードは扱わない）。
// セッションは .playwright-session/（git 管理外）に保持し、次回以降の再ログインを省く。

const SESSION_DIR = ".playwright-session";
const LOGIN_TIMEOUT_MS = 8 * 60 * 1000;
const NUDGE_INTERVAL_MS = 20 * 1000;

function extractOAuth(header: string | undefined): string | null {
  if (!header) return null;
  const m = header.match(/^OAuth\s+(.+)$/i);
  return m ? m[1]!.trim() : null;
}

async function main(): Promise<void> {
  // Playwright 同梱の Chromium を独立プロセスで使う（普段の Chrome と競合させない）。
  const ctx = await chromium.launchPersistentContext(SESSION_DIR, {
    headless: false,
  });

  let captured: string | null = null;
  let resolveToken!: (t: string) => void;
  const tokenPromise = new Promise<string>((res) => (resolveToken = res));

  // 全リクエストのヘッダーを覗き、OAuth トークンを拾う。
  ctx.on("request", (req) => {
    if (captured) return;
    if (!req.url().includes("api.studyplus.jp")) return;
    const token = extractOAuth(req.headers()["authorization"]);
    if (token) {
      captured = token;
      resolveToken(token);
    }
  });

  const page = ctx.pages()[0] ?? (await ctx.newPage());
  await page.goto("https://www.studyplus.jp/");

  console.log("▶ 開いた Chrome で StudyPlus にログインしてください。ログイン後、アプリ内の画面（記録一覧など）まで進めば自動でトークンを取得します…");

  // ログイン後にユーザーが操作せず止まっていても通信を誘発するため、
  // StudyPlus アプリ画面に居るときだけ定期リロードする（Google ログイン画面では触らない）。
  const nudge = setInterval(() => {
    if (captured) return;
    const url = page.url();
    const onApp = /studyplus\.jp/.test(url) && !/login|signin|auth/i.test(url) && !/google\.com/.test(url);
    if (onApp) page.reload({ waitUntil: "domcontentloaded" }).catch(() => {});
  }, NUDGE_INTERVAL_MS);

  const timeout = new Promise<never>((_, rej) =>
    setTimeout(() => rej(new Error("時間内にトークンを取得できませんでした（ログイン未完了？）")), LOGIN_TIMEOUT_MS),
  );

  let token: string;
  try {
    token = await Promise.race([tokenPromise, timeout]);
  } finally {
    clearInterval(nudge);
    // 取得できたら閉じる。失敗時もブラウザは閉じる。
    await ctx.close();
  }

  // 保管前に疎通確認。
  try {
    await new StudyPlusApi(token).me();
  } catch (err) {
    if (err instanceof AuthError) throw new Error("取得したトークンが無効（401）でした。");
    throw err;
  }

  await setToken(token);
  const stored = await getToken();
  console.log(stored === token ? "✓ トークンを Keychain に保管しました（/me 疎通OK）。" : "保管の確認に失敗しました。");
}

main().catch((err) => {
  console.error("seed(playwright) 失敗:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
