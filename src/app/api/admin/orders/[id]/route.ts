import { NextResponse } from "next/server";
import { requireAdminApi } from "@/features/admin/admin-guard";
import { staffTransitionSchema } from "@/features/admin/order-admin-schema";
import { toFieldErrors } from "@/features/checkout/checkout-schema";
import { canonicalOrderId } from "@/features/order-access/order-id";
import { orderService } from "@/features/orders/server";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/http";

/**
 * PATCH /api/admin/orders/:id - nhân viên chuyển trạng thái đơn. Body { from, to }: `from` là
 * Trạng thái kỳ vọng (lệch thì 409 ORDER_STATUS_CONFLICT). Trả Order đầy đủ.
 */
export async function PATCH(request: Request, route: RouteContext<"/api/admin/orders/[id]">) {
  const ctx = await requireAdminApi(request);
  if (ctx instanceof Response) return ctx;
  try {
    const body = await readJsonBody(request);
    if (body === undefined) {
      return jsonError(400, "VALIDATION_ERROR", "Body phải là JSON hợp lệ");
    }
    const parsed = staffTransitionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        "Thông tin chuyển trạng thái không hợp lệ",
        toFieldErrors(parsed.error),
      );
    }
    const { id } = await route.params;
    return NextResponse.json(
      await orderService.transitionByStaff(ctx, canonicalOrderId(id), parsed.data),
    );
  } catch (error) {
    return handleRouteError(error);
  }
}
