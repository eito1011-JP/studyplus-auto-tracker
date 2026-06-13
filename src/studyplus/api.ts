// StudyPlus 非公開 API v2 のリクエスト組み立て（純ロジック）と HTTP クライアント。
// 仕様は SPEC.md「StudyPlus API 仕様」準拠。

const BASE_URL = "https://api.studyplus.jp/2";

/** 401（トークン失効）を表す専用エラー。pusher が再シード通知に使う。 */
export class AuthError extends Error {
  constructor(message = "StudyPlus 認証エラー（401）") {
    super(message);
    this.name = "AuthError";
  }
}

export function buildHeaders(token: string): Record<string, string> {
  return {
    authorization: `OAuth ${token}`,
    "content-type": "application/json; charset=utf-8",
    "client-service": "Studyplus",
    "stpl-client-sp2": "1",
  };
}

export interface StudyRecordInput {
  materialCode: string;
  /** 作業ブロックの開始時刻（epoch ms）。ISO8601(+09:00) に整形して送る。 */
  startMs: number;
  durationSec: number;
  postToken: string;
  comment?: string;
}

/** epoch ms を JST(+09:00) の ISO8601 文字列にする（record_datetime 用）。 */
export function toJstIso(ms: number): string {
  const jst = new Date(ms + 9 * 60 * 60 * 1000);
  const p = (n: number, w = 2) => String(n).padStart(w, "0");
  const ms3 = p(jst.getUTCMilliseconds(), 3);
  return (
    `${jst.getUTCFullYear()}-${p(jst.getUTCMonth() + 1)}-${p(jst.getUTCDate())}` +
    `T${p(jst.getUTCHours())}:${p(jst.getUTCMinutes())}:${p(jst.getUTCSeconds())}.${ms3}+09:00`
  );
}

export function buildStudyRecordBody(input: StudyRecordInput): Record<string, unknown> {
  return {
    material_code: input.materialCode,
    record_datetime: toJstIso(input.startMs),
    duration: input.durationSec,
    post_token: input.postToken,
    comment: input.comment ?? "",
    study_source_type: "studyplus",
    runtimeType: "default",
  };
}

export interface ShelfMaterial {
  code: string;
  title: string;
}

/** StudyPlus API の薄いクライアント。 */
export class StudyPlusApi {
  constructor(
    private readonly token: string,
    private readonly baseUrl: string = BASE_URL,
  ) {}

  private headers(): Record<string, string> {
    return buildHeaders(this.token);
  }

  /** 認証確認。401 で AuthError。 */
  async me(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/me`, { headers: this.headers() });
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(`GET /me -> ${res.status}`);
  }

  /** /me から自分の username を得る（本棚エンドポイントに必要）。 */
  private async myUsername(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/me`, { headers: this.headers() });
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(`GET /me -> ${res.status}`);
    const j = (await res.json()) as { username?: string };
    if (!j.username) throw new Error("/me に username がありません");
    return j.username;
  }

  /** 自分の本棚から名前一致の教材コードを返す。自作(private)教材もここに含まれる。 */
  async findMaterialCode(name: string): Promise<string | null> {
    const username = await this.myUsername();
    const url = `${this.baseUrl}/bookshelf_entries?username=${encodeURIComponent(username)}&include_categories=true&include_drill=true`;
    const res = await fetch(url, { headers: this.headers() });
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(`GET /bookshelf_entries -> ${res.status}`);
    const materials = flattenShelf(await res.json());
    return materials.find((m) => m.title === name)?.code ?? null;
  }

  async postRecord(input: StudyRecordInput): Promise<void> {
    const res = await fetch(`${this.baseUrl}/study_records`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(buildStudyRecordBody(input)),
    });
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(`POST /study_records -> ${res.status}: ${await res.text()}`);
  }
}

/**
 * 本棚レスポンス（bookshelf_entries.{open,in_progress,closed}[]）を平坦化する（純ロジック）。
 * 自作(private)教材・書籍教材いずれも material_code / material_title を持つ。
 */
export function flattenShelf(json: unknown): ShelfMaterial[] {
  const be = (json as Record<string, unknown>)?.["bookshelf_entries"];
  if (!be || typeof be !== "object") return [];
  const out: ShelfMaterial[] = [];
  for (const bucket of Object.values(be as Record<string, unknown>)) {
    if (!Array.isArray(bucket)) continue;
    for (const item of bucket) {
      const o = item as Record<string, unknown>;
      const code = o["material_code"];
      const title = o["material_title"];
      if (typeof code === "string" && typeof title === "string") out.push({ code, title });
    }
  }
  return out;
}
