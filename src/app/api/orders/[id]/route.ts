import { NextResponse } from "next/server";
import { requireAdminApi } from "@/features/admin/admin-guard";
import { canonicalOrderId } from "@/features/order-access/order-id";
import { getRequestGrantToken, hasGrant } from "@/features/order-access/order-grant";
import { orderService } from "@/features/orders/server";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/http";

const unauthorized = () =>
  jsonError(401, "UNAUTHORIZED", "Bạn cần tra cứu đơn hàng để thực hiện thao tác này");

/**
 * GET /api/orders/:id - phiên quản trị: Order đầy đủ; grant đúng id: MaskedOrder;
 * còn lại 401 (cùng body dù đơn có tồn tại hay không).
 */
export async function GET(request: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  try {
    const admin = await requireAdminApi(request);
    if (!(admin instanceof Response)) {
      return NextResponse.json(await orderService.getOrderForStaff(admin, canonicalOrderId(id)));
    }
    if (!hasGrant(getRequestGrantToken(request), id)) return unauthorized();
    return NextResponse.json(await orderService.getMaskedOrder(canonicalOrderId(id)));
  } catch (error) {
    return handleRouteError(error);
  }
}

/**
 * PATCH /api/orders/:id - khách tự hủy đơn, cần grant đúng id (phiên quản trị không đủ):
 * body { "status": "cancelled" }. Nhân viên đổi trạng thái qua route quản trị.
 */
export async function PATCH(request: Request, ctx: RouteContext<"/api/orders/[id]">) {
  const { id } = await ctx.params;
  if (!hasGrant(getRequestGrantToken(request), id)) return unauthorized();
  const body = (await readJsonBody(request)) as { status?: unknown } | undefined;

  if (body?.status !== "cancelled") {
    return jsonError(400, "VALIDATION_ERROR", 'Chỉ hỗ trợ cập nhật { "status": "cancelled" }');
  }

  try {
    return NextResponse.json(await orderService.cancelOrder(canonicalOrderId(id)));
  } catch (error) {
    return handleRouteError(error);
  }
}
