import { describe, it, expect } from "vitest";
import { blockize, isFinal } from "../src/blocks/blockize.js";
import type { Interval } from "../src/blocks/types.js";

const MIN = 60 * 1000;
const t = (hhmm: string): number => {
  // テスト可読性のため "HH:MM" を 2026-06-13 のローカル epoch ms に変換
  const [h, m] = hhmm.split(":").map(Number);
  return Date.UTC(2026, 5, 13, h!, m!) ; // UTC 固定でズレを排除
};
const iv = (a: string, b: string): Interval => ({ start: t(a), end: t(b) });

const opts = { idleGapMs: 15 * MIN };

describe("blockize", () => {
  it("空入力は空ブロック", () => {
    expect(blockize([], opts)).toEqual([]);
  });

  it("単一区間は1ブロック・実稼働＝区間長", () => {
    const blocks = blockize([iv("10:00", "10:30")], opts);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.start).toBe(t("10:00"));
    expect(blocks[0]!.end).toBe(t("10:30"));
    expect(blocks[0]!.activeSec).toBe(30 * 60);
  });

  it("隙間 < 15分 は連結（休憩は実稼働に含めない）", () => {
    // 10:00-10:10 作業, 8分休憩, 10:18-10:40 作業 → 1ブロック / span 40分 / 実稼働 32分
    const blocks = blockize([iv("10:00", "10:10"), iv("10:18", "10:40")], opts);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.start).toBe(t("10:00"));
    expect(blocks[0]!.end).toBe(t("10:40"));
    expect(blocks[0]!.activeSec).toBe((10 + 22) * 60);
  });

  it("隙間 >= 15分 で別ブロックに区切る", () => {
    // 10:00-10:10, 20分の隙間, 10:30-10:50 → 2ブロック
    const blocks = blockize([iv("10:00", "10:10"), iv("10:30", "10:50")], opts);
    expect(blocks).toHaveLength(2);
    expect(blocks[0]!.end).toBe(t("10:10"));
    expect(blocks[1]!.start).toBe(t("10:30"));
  });

  it("ちょうど15分の隙間は区切る（>= の境界）", () => {
    const blocks = blockize([iv("10:00", "10:10"), iv("10:25", "10:35")], opts);
    expect(blocks).toHaveLength(2);
  });

  it("順不同・重複する区間も正しくマージ", () => {
    const blocks = blockize([iv("10:20", "10:40"), iv("10:00", "10:25")], opts);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.start).toBe(t("10:00"));
    expect(blocks[0]!.end).toBe(t("10:40"));
    // 重複ぶんは二重カウントしない：span = 40分ぶんが実稼働
    expect(blocks[0]!.activeSec).toBe(40 * 60);
  });

  it("同一 start から決定的に同じ id を生成", () => {
    const a = blockize([iv("10:00", "10:30")], opts)[0]!;
    const b = blockize([iv("10:00", "10:45")], opts)[0]!;
    expect(a.id).toBe(b.id); // id は start のみに依存
  });
});

describe("isFinal", () => {
  const block = { id: "x", start: t("10:00"), end: t("10:30"), activeSec: 1800 };

  it("末尾から 15分超の沈黙で確定", () => {
    const now = t("10:46"); // 16分後
    expect(isFinal(block, now, 15 * MIN)).toBe(true);
  });

  it("ちょうど15分後はまだ未確定（まだ伸びうる）", () => {
    const now = t("10:45");
    expect(isFinal(block, now, 15 * MIN)).toBe(false);
  });

  it("沈黙が閾値未満なら未確定", () => {
    const now = t("10:35");
    expect(isFinal(block, now, 15 * MIN)).toBe(false);
  });
});
