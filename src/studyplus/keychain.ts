import { execFile } from "node:child_process";
import { promisify } from "node:util";

const exec = promisify(execFile);

// macOS Keychain にアクセストークンを保管する（決定 #12）。
const SERVICE = "studyplus-auto-tracker";
const ACCOUNT = "access_token";

export async function setToken(token: string): Promise<void> {
  // -U: 既存なら更新。-w: パスワード（トークン）本体。
  await exec("security", ["add-generic-password", "-U", "-a", ACCOUNT, "-s", SERVICE, "-w", token]);
}

export async function getToken(): Promise<string | null> {
  try {
    const { stdout } = await exec("security", ["find-generic-password", "-a", ACCOUNT, "-s", SERVICE, "-w"]);
    const token = stdout.trim();
    return token.length > 0 ? token : null;
  } catch {
    // 未登録時は security が非0終了する。それは「トークン無し」として扱う。
    return null;
  }
}

export async function deleteToken(): Promise<void> {
  try {
    await exec("security", ["delete-generic-password", "-a", ACCOUNT, "-s", SERVICE]);
  } catch {
    // 無ければ何もしない。
  }
}
