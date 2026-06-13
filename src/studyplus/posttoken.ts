import { v5 as uuidv5 } from "uuid";

// block ID から決定的に post_token(冪等UUID) を導く（決定 #10）。
// 同じブロックは常に同じトークン → 再試行しても API 側で重複作成されない。
// 固定の名前空間 UUID（このツール専用に1回生成した定数）。
const NAMESPACE = "6b1f9e2c-3a47-5d8b-9c10-2e7f4a6d8b13";

export function postTokenFor(blockId: string): string {
  return uuidv5(blockId, NAMESPACE);
}
