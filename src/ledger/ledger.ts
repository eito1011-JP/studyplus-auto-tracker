import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { Block } from "../blocks/types.js";

export type LedgerStatus = "pending" | "done";

export interface LedgerEntry {
  id: string;
  start: number;
  end: number;
  activeSec: number;
  status: LedgerStatus;
  /** 投稿成功時刻（done のみ）。 */
  postedAt?: number;
  /** 投稿試行回数（Step 3 の再試行で使う）。 */
  attempts: number;
}

/**
 * 投稿済み台帳（決定 #10 の自前台帳）。block ID をキーに投稿状態を保持する。
 * .state/ledger.json に JSON で永続化（git 管理外）。
 */
export class Ledger {
  private entries = new Map<string, LedgerEntry>();

  private constructor(private readonly path: string) {}

  static async load(path: string): Promise<Ledger> {
    const ledger = new Ledger(path);
    try {
      const raw = await readFile(path, "utf8");
      const parsed = JSON.parse(raw) as LedgerEntry[];
      for (const e of parsed) ledger.entries.set(e.id, e);
    } catch (err) {
      // 初回はファイル無しが正常。それ以外の読み取り/パース失敗は握りつぶさず投げる。
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
    }
    return ledger;
  }

  has(id: string): boolean {
    return this.entries.has(id);
  }

  get(id: string): LedgerEntry | undefined {
    return this.entries.get(id);
  }

  all(): LedgerEntry[] {
    return [...this.entries.values()];
  }

  /** 未知の確定ブロックを pending として登録する（既知なら何もしない）。返り値は新規登録ぶん。 */
  recordPending(blocks: Block[]): LedgerEntry[] {
    const added: LedgerEntry[] = [];
    for (const b of blocks) {
      if (this.entries.has(b.id)) continue;
      const entry: LedgerEntry = {
        id: b.id,
        start: b.start,
        end: b.end,
        activeSec: b.activeSec,
        status: "pending",
        attempts: 0,
      };
      this.entries.set(b.id, entry);
      added.push(entry);
    }
    return added;
  }

  pending(): LedgerEntry[] {
    return this.all().filter((e) => e.status === "pending");
  }

  done(): LedgerEntry[] {
    return this.all().filter((e) => e.status === "done");
  }

  /** 投稿成功として確定する。 */
  markDone(id: string, postedAt: number): void {
    const e = this.entries.get(id);
    if (!e) return;
    e.status = "done";
    e.postedAt = postedAt;
    e.attempts += 1;
  }

  /** 投稿失敗（pending のまま試行回数だけ加算）。 */
  markFailed(id: string): void {
    const e = this.entries.get(id);
    if (!e) return;
    e.attempts += 1;
  }

  async save(): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, JSON.stringify(this.all(), null, 2), "utf8");
  }
}
