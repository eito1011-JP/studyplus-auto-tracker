import type { AwEvent } from "./events.js";

const DEFAULT_BASE = "http://localhost:5600";

interface BucketInfo {
  id: string;
  type: string;
}

/** ActivityWatch ローカル REST API のクライアント。bucket は型から動的に解決する（hostname 依存を避ける）。 */
export class AwClient {
  constructor(private readonly baseUrl: string = DEFAULT_BASE) {}

  private async getJson<T>(path: string): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`);
    if (!res.ok) throw new Error(`AW GET ${path} -> ${res.status}`);
    return (await res.json()) as T;
  }

  /** window / afk バケットの ID を型で解決する。 */
  async resolveBuckets(): Promise<{ window: string; afk: string }> {
    const buckets = await this.getJson<Record<string, BucketInfo>>("/api/0/buckets/");
    const list = Object.values(buckets);
    const window = list.find((b) => b.type === "currentwindow")?.id;
    const afk = list.find((b) => b.type === "afkstatus")?.id;
    if (!window || !afk) {
      throw new Error(`必要な bucket が見つからない (window=${window}, afk=${afk})。watcher が起動しているか確認。`);
    }
    return { window, afk };
  }

  /**
   * 指定期間の「not-AFK 期間に交差した window イベント」を AQL で取得する。
   * app 別マージはしない（個々のイベントの app/title/時刻が分類に必要なため）。
   */
  async queryNotAfkWindowEvents(startMs: number, endMs: number): Promise<AwEvent[]> {
    const { window, afk } = await this.resolveBuckets();
    const period = `${new Date(startMs).toISOString()}/${new Date(endMs).toISOString()}`;
    const query = [
      `afk = query_bucket('${afk}');`,
      `notafk = filter_keyvals(afk, 'status', ['not-afk']);`,
      `win = query_bucket('${window}');`,
      `win = filter_period_intersect(win, notafk);`,
      `RETURN = win;`,
    ].join(" ");

    const res = await fetch(`${this.baseUrl}/api/0/query/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ timeperiods: [period], query: [query] }),
    });
    if (!res.ok) throw new Error(`AW query -> ${res.status}: ${await res.text()}`);
    const result = (await res.json()) as AwEvent[][];
    return result[0] ?? [];
  }
}
