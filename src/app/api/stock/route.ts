import { NextResponse } from "next/server";
import { getCurrentStockMap } from "@/features/inventory/server";
import { handleRouteError } from "@/lib/http";

/** GET /api/stock - Tồn hiện tại theo productId (công khai, không kèm thông tin đơn). */
export async function GET() {
  try {
    const stock = await getCurrentStockMap();
    return NextResponse.json({ stock }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return handleRouteError(error);
  }
}
