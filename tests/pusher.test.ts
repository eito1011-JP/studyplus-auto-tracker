import { describe, it, expect, afterEach } from "vitest";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Ledger } from "../src/ledger/ledger.js";
import { pushPending, type RecordPoster } from "../src/pusher.js";
import { AuthError } from "../src/studyplus/api.js";
import type { Block } from "../src/blocks/types.js";

const block = (id: string): Block => ({ id, start: 1000, end: 2000, activeSec: 60 });

const dirs: string[] = [];
afterEach(async () => {
  while (dirs.length) await rm(dirs.pop()!, { recursive: true, force: true });
});

async function freshLedger(ids: string[]): Promise<Ledger> {
  const dir = await mkdtemp(join(tmpdir(), "sp-led-"));
  dirs.push(dir);
  const ledger = await Ledger.load(join(dir, "ledger.json"));
  ledger.recordPending(ids.map(block));
  return ledger;
}

describe("pushPending", () => {
  it("全部成功で done になる", async () => {
    const ledger = await freshLedger(["a", "b"]);
    const poster: RecordPoster = { postRecord: async () => {} };
    const r = await pushPending(ledger, poster, "MAT", 9999);
    expect(r).toEqual({ posted: 2, failed: 0, authFailed: false });
    expect(ledger.pending()).toHaveLength(0);
    expect(ledger.done()).toHaveLength(2);
    expect(ledger.get("a")!.postedAt).toBe(9999);
  });

  it("通常エラーは pending のまま attempts 加算", async () => {
    const ledger = await freshLedger(["a"]);
    const poster: RecordPoster = {
      postRecord: async () => {
        throw new Error("500");
      },
    };
    const r = await pushPending(ledger, poster, "MAT", 1);
    expect(r.posted).toBe(0);
    expect(r.failed).toBe(1);
    expect(ledger.get("a")!.status).toBe("pending");
    expect(ledger.get("a")!.attempts).toBe(1);
  });

  it("401 で打ち切り、残りは pending のまま", async () => {
    const ledger = await freshLedger(["a", "b"]);
    let calls = 0;
    const poster: RecordPoster = {
      postRecord: async () => {
        calls += 1;
        throw new AuthError();
      },
    };
    const r = await pushPending(ledger, poster, "MAT", 1);
    expect(r.authFailed).toBe(true);
    expect(calls).toBe(1);
    expect(ledger.pending()).toHaveLength(2);
  });
});
