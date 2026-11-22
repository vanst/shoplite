// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getCatalogProducts } from "@/features/catalog/catalog-data";
import type { Order } from "@/features/orders/types";
import { GET as getBySlug } from "./[slug]/route";
import { GET as getList } from "./route";

const base = getCatalogProducts().find((p) => p.stock > 2)!;

vi.mock("@/features/inventory/server", async () => {
  const { createInventoryService } = await import("@/features/inventory/inventory-service");
  const { createInMemoryOrderRepository } = await import("@/features/orders/order-repository");
  const { getCatalogProducts } = await import("@/features/catalog/catalog-data");
  const repository = createInMemoryOrderRepository();
  const product = getCatalogProducts().find((p) => p.stock > 2)!;
  await repository.save({
    id: "SL-1",
    status: "confirmed",
    items: [{ productId: product.id, quantity: product.stock }],
  } as unknown as Order);
  return {
    inventoryService: createInventoryService({ repository, getBaseProducts: getCatalogProducts }),
  };
});

describe("API sản phẩm trả Tồn hiện tại", () => {
  it("GET /api/products/:slug trả stock 0 dù Tồn gốc lớn hơn 0", async () => {
    const res = await getBySlug(new Request("http://x"), {
      params: Promise.resolve({ slug: base.slug }),
    } as never);
    expect((await res.json()).stock).toBe(0);
  });

  it("slug không tồn tại trả 404", async () => {
    const res = await getBySlug(new Request("http://x"), {
      params: Promise.resolve({ slug: "khong-co" }),
    } as never);
    expect(res.status).toBe(404);
  });

  it("GET /api/products với inStock=1 loại sản phẩm đã hết tồn hiện tại", async () => {
    const res = await getList({
      nextUrl: new URL("http://x/api/products?inStock=1"),
    } as never);
    const body = await res.json();
    expect(body.items.map((p: { id: string }) => p.id)).not.toContain(base.id);
  });
});
