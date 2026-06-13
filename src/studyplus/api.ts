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

export interface MaterialEntry {
  code: string;
  name: string;
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

  /** 教材一覧を取得し、名前一致の教材コードを返す。 */
  async findMaterialCode(name: string): Promise<string | null> {
    const res = await fetch(`${this.baseUrl}/book/book_material_entries`, { headers: this.headers() });
    if (res.status === 401) throw new AuthError();
    if (!res.ok) throw new Error(`GET /book/book_material_entries -> ${res.status}`);
    const json = (await res.json()) as unknown;
    const entries = extractMaterials(json);
    return entries.find((m) => m.name === name)?.code ?? null;
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

/** 教材一覧レスポンスから {code,name} を抽出する（レスポンス形の揺れに緩く対応）。 */
export function extractMaterials(json: unknown): MaterialEntry[] {
  const arr = Array.isArray(json)
    ? json
    : Array.isArray((json as Record<string, unknown>)?.["book_material_entries"])
      ? ((json as Record<string, unknown>)["book_material_entries"] as unknown[])
      : Array.isArray((json as Record<string, unknown>)?.["entries"])
        ? ((json as Record<string, unknown>)["entries"] as unknown[])
        : [];
  const out: MaterialEntry[] = [];
  for (const item of arr) {
    const o = item as Record<string, unknown>;
    const code = (o["material_code"] ?? o["code"]) as string | undefined;
    const name = (o["title"] ?? o["name"]) as string | undefined;
    if (typeof code === "string" && typeof name === "string") out.push({ code, name });
  }
  return out;
}
