import { createHash, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { buildCookie, readCookie } from "@/lib/cookie";
import { jsonError } from "@/lib/http";
import { signToken, verifyToken } from "@/lib/signed-token";

const COOKIE_NAME = "shoplite_admin";
const SESSION_TTL_MS = 12 * 60 * 60 * 1000;
const SESSION_PURPOSE = "admin-session";
const KEY_SALT = "shoplite/admin-session/v1";

/** Ngữ cảnh mờ chứng minh đã qua guard; chỉ guard mới tạo được. */
declare const adminContextBrand: unique symbol;
export type AdminContext = { readonly [adminContextBrand]: true };
const adminContext = {} as AdminContext;

/** Chốt chặn duy nhất của khu vực quản trị; cũng là nơi duy nhất đọc biến môi trường mật khẩu. */
export function isAdminEnabled(): boolean {
  return (process.env.ADMIN_PASSWORD ?? "") !== "";
}

/** Chưa cấu hình thì trả đúng trang 404 gốc, trước mọi streaming. */
export function assertAdminEnabled(): void {
  if (!isAdminEnabled()) notFound();
}

/** Cổng cấu hình cho API: 404 thân rỗng khi chưa đặt mật khẩu, null nếu đã bật. */
export function adminGate(): Response | null {
  return isAdminEnabled() ? null : new Response(null, { status: 404 });
}

let cachedKey: { password: string; key: Buffer } | undefined;

/** Khóa phiên dẫn xuất từ mật khẩu (tính lười, cache theo giá trị); đổi mật khẩu thì phiên cũ vô hiệu. */
function sessionKey(): Buffer {
  const password = process.env.ADMIN_PASSWORD ?? "";
  if (cachedKey?.password !== password) {
    cachedKey = { password, key: scryptSync(password, KEY_SALT, 32) };
  }
  return cachedKey.key;
}

function isValidSession(token: string | undefined): boolean {
  return (
    token !== undefined &&
    verifyToken(token, { key: sessionKey(), purpose: SESSION_PURPOSE }) !== null
  );
}

/** Trạng thái cookie phiên: hợp lệ, có nhưng sai/hết hạn, hoặc không có. */
export async function getAdminSession(): Promise<"valid" | "invalid" | "none"> {
  if (!isAdminEnabled()) return "none"; // khóa rỗng ký được token, không được coi là phiên
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (token === undefined) return "none";
  return isValidSession(token) ? "valid" : "invalid";
}

/** Dòng đầu của mọi page /admin/** (trừ login). */
export async function requireAdmin(currentPath: string): Promise<AdminContext> {
  assertAdminEnabled();
  if ((await getAdminSession()) !== "valid") {
    redirect(`/admin/login?next=${encodeURIComponent(currentPath)}`);
  }
  return adminContext;
}

/** Dòng đầu của mọi handler /api/admin/**: trả Response để từ chối, AdminContext nếu được phép. */
export async function requireAdminApi(request: Request): Promise<AdminContext | Response> {
  const gate = adminGate();
  if (gate) return gate;
  if (!isValidSession(readCookie(request, COOKIE_NAME))) {
    return jsonError(401, "UNAUTHORIZED", "Bạn cần đăng nhập để thực hiện thao tác này");
  }
  return adminContext;
}

/** So mật khẩu bằng SHA-256 hai vế + timingSafeEqual để không lộ độ dài hay vị trí khác biệt. */
export function checkAdminPassword(candidate: string): boolean {
  if (!isAdminEnabled()) return false;
  const hash = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(hash(candidate), hash(process.env.ADMIN_PASSWORD ?? ""));
}

/** Giá trị Set-Cookie cho phiên mới, hết hạn tuyệt đối 12 giờ. */
export function createSessionCookie(request: Request): string {
  const token = signToken(
    { sub: "admin" },
    { key: sessionKey(), purpose: SESSION_PURPOSE, ttlMs: SESSION_TTL_MS },
  );
  return buildCookie(COOKIE_NAME, token, SESSION_TTL_MS / 1000, request);
}

/** Giá trị Set-Cookie xóa phiên (hết hạn trong quá khứ). */
export function clearSessionCookie(request: Request): string {
  return buildCookie(COOKIE_NAME, "", 0, request);
}
