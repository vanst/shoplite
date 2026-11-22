import { NextResponse, type NextRequest } from "next/server";
import { MAX_QUERY_LENGTH, MIN_QUERY_LENGTH } from "@/features/catalog/suggest-rules";
import { getSuggestions } from "@/features/catalog/suggest-service";
import { inventoryService } from "@/features/inventory/server";
import { handleRouteError, jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/products/suggest?q= - tối đa 5 gợi ý cho ô tìm kiếm. */
export async function GET(request: NextRequest) {
  try {
    const q = request.nextUrl.searchParams.get("q")?.trim() ?? "";
    if (q.length < MIN_QUERY_LENGTH || q.length > MAX_QUERY_LENGTH) {
      return jsonError(
        400,
        "VALIDATION_ERROR",
        `Từ khóa phải có từ ${MIN_QUERY_LENGTH} đến ${MAX_QUERY_LENGTH} ký tự`,
      );
    }
    const products = await inventoryService.getStockedProducts();
    return NextResponse.json({ suggestions: getSuggestions(q, products) });
  } catch (error) {
    return handleRouteError(error);
  }
}
