import { describe, it, expect } from "vitest";
import { toCountableIntervals, type AwEvent } from "../src/aw/events.js";
import type { TrackerConfig } from "../src/config.js";

const cfg: TrackerConfig = {
  alwaysCountApps: ["Ghostty"],
  titleGatedApps: ["Dia"],
  devTitlePatterns: [/github\.com/i],
  idleGapMs: 15 * 60 * 1000,
  finalizeSilenceMs: 15 * 60 * 1000,
};

const ev = (timestamp: string, duration: number, app: string, title = ""): AwEvent => ({
  timestamp,
  duration,
  data: { app, title },
});

describe("toCountableIntervals", () => {
  it("対象アプリは start/end の区間になる", () => {
    const out = toCountableIntervals([ev("2026-06-13T10:00:00.000Z", 600, "Ghostty")], cfg);
    expect(out).toHaveLength(1);
    expect(out[0]!.start).toBe(Date.parse("2026-06-13T10:00:00.000Z"));
    expect(out[0]!.end).toBe(Date.parse("2026-06-13T10:10:00.000Z"));
  });

  it("対象外アプリ・非開発ブラウザタイトルは除外", () => {
    const out = toCountableIntervals(
      [
        ev("2026-06-13T10:00:00.000Z", 600, "Slack"),
        ev("2026-06-13T10:10:00.000Z", 600, "Dia", "YouTube"),
      ],
      cfg,
    );
    expect(out).toHaveLength(0);
  });

  it("開発タイトルのブラウザは対象", () => {
    const out = toCountableIntervals(
      [ev("2026-06-13T10:00:00.000Z", 300, "Dia", "github.com/foo")],
      cfg,
    );
    expect(out).toHaveLength(1);
  });

  it("duration 0 は捨てる", () => {
    const out = toCountableIntervals([ev("2026-06-13T10:00:00.000Z", 0, "Ghostty")], cfg);
    expect(out).toHaveLength(0);
  });
});
