import { NextResponse } from "next/server";
import { requireAdminApi } from "@/features/admin/admin-guard";
import { issueGrantCookie } from "@/features/order-access/order-grant";
import { orderService } from "@/features/orders/server";
import { handleRouteError, jsonError, readJsonBody } from "@/lib/http";

/** GET /api/orders - danh sách đơn đầy đủ cho nhân viên, mới nhất trước. */
export async function GET(request: Request) {
  const ctx = await requireAdminApi(request);
  if (ctx instanceof Response) return ctx;
  try {
    const orders = await orderService.listOrders(ctx);
    return NextResponse.json({ orders });
  } catch (error) {
    return handleRouteError(error);
  }
}

/** POST /api/orders - tạo đơn hàng mới. Body: PlaceOrderInput (xem checkout-schema.ts). Trả MaskedOrder + cookie grant. */
export async function POST(request: Request) {
  const body = await readJsonBody(request);
  if (body === undefined) {
    return jsonError(400, "VALIDATION_ERROR", "Body phải là JSON hợp lệ");
  }

  try {
    const order = await orderService.placeOrder(body);
    const response = NextResponse.json(order, { status: 201 });
    response.headers.append("Set-Cookie", issueGrantCookie(request, order.id, "placed"));
    return response;
  } catch (error) {
    return handleRouteError(error);
  }
}
