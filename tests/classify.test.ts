import { describe, it, expect } from "vitest";
import { isCountable } from "../src/blocks/classify.js";
import type { TrackerConfig } from "../src/config.js";

const cfg: TrackerConfig = {
  alwaysCountApps: ["Code", "Ghostty"],
  titleGatedApps: ["Dia"],
  devTitlePatterns: [/github\.com/i, /localhost/i, /zenn\.dev/i],
  idleGapMs: 15 * 60 * 1000,
  finalizeSilenceMs: 15 * 60 * 1000,
  materialName: "アプリ開発",
};

describe("isCountable", () => {
  it("エディタは app 名一致だけで対象（タイトル不問）", () => {
    expect(isCountable({ app: "Code", title: "anything.ts" }, cfg)).toBe(true);
    expect(isCountable({ app: "Code", title: "" }, cfg)).toBe(true);
  });

  it("ターミナルは app 名一致だけで対象", () => {
    expect(isCountable({ app: "Ghostty", title: "zsh" }, cfg)).toBe(true);
  });

  it("ブラウザは開発関連タイトルのときだけ対象", () => {
    expect(isCountable({ app: "Dia", title: "github.com/foo/bar" }, cfg)).toBe(true);
    expect(isCountable({ app: "Dia", title: "localhost:3000" }, cfg)).toBe(true);
    expect(isCountable({ app: "Dia", title: "zenn.dev/article" }, cfg)).toBe(true);
  });

  it("ブラウザの非開発タイトルは対象外", () => {
    expect(isCountable({ app: "Dia", title: "YouTube - 音楽" }, cfg)).toBe(false);
    expect(isCountable({ app: "Dia", title: "New Tab" }, cfg)).toBe(false);
  });

  it("ホワイトリスト外のアプリは対象外", () => {
    expect(isCountable({ app: "Slack", title: "github.com" }, cfg)).toBe(false);
    expect(isCountable({ app: "System Settings", title: "" }, cfg)).toBe(false);
  });
});
