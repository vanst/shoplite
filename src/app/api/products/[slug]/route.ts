import { NextResponse } from "next/server";
import { inventoryService } from "@/features/inventory/server";
import { jsonError } from "@/lib/http";

export const dynamic = "force-dynamic";

/** GET /api/products/:slug */
export async function GET(_request: Request, ctx: RouteContext<"/api/products/[slug]">) {
  const { slug } = await ctx.params;
  const product = await inventoryService.getStockedProductBySlug(slug);
  if (!product) {
    return jsonError(404, "PRODUCT_NOT_FOUND", `Không tìm thấy sản phẩm "${slug}"`);
  }
  return NextResponse.json(product);
}
