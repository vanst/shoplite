import { NextResponse, type NextRequest } from "next/server";
import { getCategories } from "@/features/catalog/catalog-data";
import { parseCatalogQuery, queryProducts } from "@/features/catalog/catalog-rules";
import { inventoryService } from "@/features/inventory/server";

export const dynamic = "force-dynamic";

/** GET /api/products?q=&category=&minPrice=&maxPrice=&inStock=1&sort=&page= */
export async function GET(request: NextRequest) {
  const query = parseCatalogQuery(Object.fromEntries(request.nextUrl.searchParams));
  const products = await inventoryService.getStockedProducts();
  return NextResponse.json(queryProducts(products, getCategories(), query));
}
