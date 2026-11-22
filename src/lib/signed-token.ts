import { createHmac, timingSafeEqual } from "node:crypto";

type Options = { key: Buffer | string; purpose: string; now?: () => number };

function mac(key: Buffer | string, purpose: string, body: string): Buffer {
  return createHmac("sha256", key).update(`${purpose}.${body}`).digest();
}

/** Ký payload thành `base64url(JSON).base64url(HMAC)`; `exp` là mili giây epoch. */
export function signToken(
  payload: Record<string, unknown>,
  { key, purpose, now = Date.now, ttlMs }: Options & { ttlMs: number },
): string {
  const body = Buffer.from(JSON.stringify({ ...payload, exp: now() + ttlMs })).toString(
    "base64url",
  );
  return `${body}.${mac(key, purpose, body).toString("base64url")}`;
}

/** Trả payload nếu token đúng chữ ký, đúng `purpose` và chưa hết hạn; mọi trường hợp khác trả null, không ném. */
export function verifyToken(
  token: string,
  { key, purpose, now = Date.now }: Options,
): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [body, signature] = parts;
    const given = Buffer.from(signature, "base64url");
    const expected = mac(key, purpose, body);
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
    const payload: unknown = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return null;
    const { exp } = payload as { exp?: unknown };
    if (typeof exp !== "number" || exp <= now()) return null;
    return payload as Record<string, unknown>;
  } catch {
    return null;
  }
}
