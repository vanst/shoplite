import { adminGate, checkAdminPassword, createSessionCookie } from "@/features/admin/admin-guard";
import { LOGIN_LOCKED_MESSAGE } from "@/features/admin/admin-messages";
import { loginLimiter } from "@/features/admin/login-limiter";
import { OrderError } from "@/features/orders/order-errors";
import { getClientKey } from "@/lib/client-key";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/http";

/** POST /api/admin/login - đăng nhập quản trị. Body: { password }. Thành công: 204 + cookie phiên. */
export async function POST(request: Request) {
  const gate = adminGate();
  if (gate) return gate;

  const clientKey = `login:${getClientKey(request)}`;
  const assertNotLocked = () => {
    const limit = loginLimiter.check(clientKey);
    if (!limit.allowed) {
      throw new OrderError("TOO_MANY_ATTEMPTS", LOGIN_LOCKED_MESSAGE, {
        retryAfterSeconds: String(limit.retryAfterSeconds),
      });
    }
  };
  try {
    assertNotLocked();
    const body = await readJsonBody(request);
    const password = (body as { password?: unknown } | null | undefined)?.password;
    if (typeof password !== "string") {
      return jsonError(400, "VALIDATION_ERROR", "Body phải là JSON có trường password dạng chuỗi");
    }
    // Kiểm lại sau await: các request song song đã qua lần kiểm đầu; không được có await từ đây đến recordFailure
    assertNotLocked();
    if (!checkAdminPassword(password)) {
      loginLimiter.recordFailure(clientKey);
      return jsonError(401, "UNAUTHORIZED", "Mật khẩu không đúng");
    }
    return new Response(null, {
      status: 204,
      headers: { "Set-Cookie": createSessionCookie(request) },
    });
  } catch (error) {
    return handleRouteError(error);
  }
}
