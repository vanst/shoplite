import { randomBytes } from "node:crypto";
import { buildCookie, readCookie } from "@/lib/cookie";
import { singleton } from "@/lib/process-singleton";
import { signToken, verifyToken } from "@/lib/signed-token";
import { canonicalOrderId } from "./order-id";

export const GRANT_COOKIE_NAME = "shoplite_grants";
const GRANT_TTL_MS = 30 * 60 * 1000;
const MAX_GRANTS = 10;
const GRANT_PURPOSE = "order-grant";

export interface OrderGrant {
  id: string;
  via: "placed" | "lookup";
  exp: number;
}

/** Khóa ký ngẫu nhiên sinh lúc khởi động; khởi động lại thì mọi quyền xem cũ mất. */
const grantKey = singleton("order-grant-key", () => randomBytes(32));

/** Đọc các grant còn hiệu lực; cookie rác, giả mạo, hết hạn thì trả mảng rỗng, không ném. */
export function readGrants(token: string | undefined, now: () => number = Date.now): OrderGrant[] {
  if (!token) return [];
  const payload = verifyToken(token, { key: grantKey, purpose: GRANT_PURPOSE, now });
  const grants = payload?.grants;
  if (!Array.isArray(grants)) return [];
  return grants.filter(
    (g): g is OrderGrant =>
      typeof g?.id === "string" &&
      (g.via === "placed" || g.via === "lookup") &&
      typeof g.exp === "number" &&
      g.exp > now(),
  );
}

export function getRequestGrantToken(request: Request): string | undefined {
  return readCookie(request, GRANT_COOKIE_NAME);
}

/** Grant còn hiệu lực đúng đơn `id` (so qua canonicalOrderId), không có thì undefined. */
export function getGrant(
  token: string | undefined,
  id: string,
  now?: () => number,
): OrderGrant | undefined {
  let wanted: string;
  try {
    wanted = canonicalOrderId(id);
  } catch {
    return undefined; // mã quá dài: không bao giờ có grant, và không được khác 401 của mã thường
  }
  return readGrants(token, now).find((g) => canonicalOrderId(g.id) === wanted);
}

export function hasGrant(token: string | undefined, id: string, now?: () => number): boolean {
  return getGrant(token, id, now) !== undefined;
}

/** Set-Cookie cấp (hoặc làm mới) grant cho `id`, giữ các grant khác; tối đa 10, loại mục sớm hết hạn nhất. */
export function issueGrantCookie(
  request: Request,
  id: string,
  via: OrderGrant["via"],
  now: () => number = Date.now,
): string {
  const canonical = canonicalOrderId(id);
  const kept = readGrants(getRequestGrantToken(request), now).filter(
    (g) => canonicalOrderId(g.id) !== canonical,
  );
  const grants = [...kept, { id: canonical, via, exp: now() + GRANT_TTL_MS }]
    .sort((a, b) => a.exp - b.exp)
    .slice(-MAX_GRANTS);
  const token = signToken(
    { grants },
    { key: grantKey, purpose: GRANT_PURPOSE, ttlMs: GRANT_TTL_MS, now },
  );
  return buildCookie(GRANT_COOKIE_NAME, token, GRANT_TTL_MS / 1000, request);
}
