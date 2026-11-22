import { NextResponse } from "next/server";
import { requireAdminApi } from "@/features/admin/admin-guard";
import { phoneSearchSchema } from "@/features/admin/order-admin-schema";
import { toFieldErrors } from "@/features/checkout/checkout-schema";
import { orderService } from "@/features/orders/server";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/http";

/**
 * POST /api/admin/orders/search - tìm đơn theo SĐT (nhân viên). SĐT chỉ đi trong body, không vào
 * URL hay log. Trả { rows: QueueRow[] } không PII.
 */
export async function POST(request: Request) {
  const ctx = await requireAdminApi(request);
  if (ctx instanceof Response) return ctx;
  try {
    const body = await readJsonBody(request);
    if (body === undefined) {
      return jsonError(400, "VALIDATION_ERROR", "Body phải là JSON hợp lệ");
    }
    const parsed = phoneSearchSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Số điện thoại không hợp lệ",
        toFieldErrors(parsed.error),
      );
    }
    const rows = await orderService.searchByPhone(ctx, parsed.data.phone);
    return NextResponse.json({ rows }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleRouteError(error);
  }
}
// Không export GET: Next tự trả 405 cho phương thức không có handler.
