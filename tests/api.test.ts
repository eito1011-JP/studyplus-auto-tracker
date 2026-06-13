import { describe, it, expect } from "vitest";
import {
  buildHeaders,
  buildStudyRecordBody,
  toJstIso,
  flattenShelf,
} from "../src/studyplus/api.js";
import { postTokenFor } from "../src/studyplus/posttoken.js";

describe("buildHeaders", () => {
  it("SPEC 通りのヘッダーを組む", () => {
    expect(buildHeaders("tok123")).toEqual({
      authorization: "OAuth tok123",
      "content-type": "application/json; charset=utf-8",
      "client-service": "Studyplus",
      "stpl-client-sp2": "1",
    });
  });
});

describe("toJstIso", () => {
  it("epoch ms を JST(+09:00) の ISO8601 にする", () => {
    // 2026-06-13T00:00:00Z = JST 09:00:00
    const ms = Date.parse("2026-06-13T00:00:00.000Z");
    expect(toJstIso(ms)).toBe("2026-06-13T09:00:00.000+09:00");
  });
});

describe("buildStudyRecordBody", () => {
  it("SPEC 通りの body を組む（duration は秒）", () => {
    const ms = Date.parse("2026-06-13T00:00:00.000Z");
    const body = buildStudyRecordBody({
      materialCode: "MAT-1",
      startMs: ms,
      durationSec: 1800,
      postToken: "PT-1",
    });
    expect(body).toEqual({
      material_code: "MAT-1",
      record_datetime: "2026-06-13T09:00:00.000+09:00",
      duration: 1800,
      post_token: "PT-1",
      comment: "",
      study_source_type: "studyplus",
      runtimeType: "default",
    });
  });
});

describe("postTokenFor", () => {
  it("同じ block ID は常に同じトークン（冪等）", () => {
    expect(postTokenFor("blk_100")).toBe(postTokenFor("blk_100"));
  });
  it("異なる block ID は異なるトークン", () => {
    expect(postTokenFor("blk_100")).not.toBe(postTokenFor("blk_200"));
  });
});

describe("flattenShelf", () => {
  it("open/in_progress/closed を平坦化して {code,title} にする", () => {
    const json = {
      bookshelf_entries: {
        open: [{ material_code: "c1", material_title: "数学" }],
        in_progress: [{ material_code: "c2", material_title: "Lexis 開発" }],
        closed: [],
      },
    };
    expect(flattenShelf(json)).toEqual([
      { code: "c1", title: "数学" },
      { code: "c2", title: "Lexis 開発" },
    ]);
  });

  it("bookshelf_entries が無ければ空配列", () => {
    expect(flattenShelf({})).toEqual([]);
  });
});
