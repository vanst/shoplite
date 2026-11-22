import { NextResponse } from "next/server";
import { canonicalOrderId } from "@/features/order-access/order-id";
import { issueGrantCookie } from "@/features/order-access/order-grant";
import { lookupLimiter } from "@/features/order-access/lookup-limiter";
import {
  LOOKUP_LOCKED_MESSAGE,
  LOOKUP_NOT_FOUND_MESSAGE,
} from "@/features/order-access/lookup-messages";
import { lookupSchema } from "@/features/order-access/lookup-schema";
import { toFieldErrors } from "@/features/checkout/checkout-schema";
import { OrderError } from "@/features/orders/order-errors";
import { orderService } from "@/features/orders/server";
import { getClientKey } from "@/lib/client-key";
import { handleRouteError, readJsonBody } from "@/lib/http";

/** POST /api/orders/lookup - body { orderId, verification }. Đúng: 200 MaskedOrder + cookie grant. */
export async function POST(request: Request) {
  const ipKey = `lookup-ip:${getClientKey(request)}`;
  const assertNotLocked = (...keys: string[]) => {
    for (const key of keys) {
      const limit = lookupLimiter.check(key);
      if (!limit.allowed) {
        throw new OrderError("TOO_MANY_ATTEMPTS", LOOKUP_LOCKED_MESSAGE, {
          retryAfterSeconds: String(limit.retryAfterSeconds),
        });
      }
    }
  };
  try {
    assertNotLocked(ipKey);
    const body = await readJsonBody(request);
    const parsed = lookupSchema.safeParse(body);
    if (!parsed.success) {
      throw new OrderError(
        "VALIDATION_ERROR",
        "Thông tin tra cứu không hợp lệ",
        toFieldErrors(parsed.error),
      );
    }
    const orderId = canonicalOrderId(parsed.data.orderId);
    const orderKey = `lookup-order:${orderId}`;
    assertNotLocked(orderKey);

    const masked = await orderService.lookupOrder(orderId, parsed.data.verification);
    // Kiểm lại sau await, không còn await nào từ đây đến recordFailure (khóa thắng mọi thông tin xác thực)
    assertNotLocked(ipKey, orderKey);
    if (!masked) {
      lookupLimiter.recordFailure(ipKey);
      lookupLimiter.recordFailure(orderKey);
      throw new OrderError("ORDER_NOT_FOUND", LOOKUP_NOT_FOUND_MESSAGE);
    }
    const response = NextResponse.json(masked);
    response.headers.append("Set-Cookie", issueGrantCookie(request, masked.id, "lookup"));
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
