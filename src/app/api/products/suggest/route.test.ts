// @vitest-environment node
import { NextRequest } from "next/server";
import { describe, expect, it, vi } from "vitest";
import { GET } from "./route";

vi.mock("@/features/inventory/server", async () => {
  const { createInventoryService } = await import("@/features/inventory/inventory-service");
  const { createInMemoryOrderRepository } = await import("@/features/orders/order-repository");
  const { getCatalogProducts } = await import("@/features/catalog/catalog-data");
  return {
    inventoryService: createInventoryService({
      repository: createInMemoryOrderRepository(),
      getBaseProducts: getCatalogProducts,
    }),
  };
});

const call = (q?: string) => {
  const url = new URL("http://localhost/api/products/suggest");
  if (q !== undefined) url.searchParams.set("q", q);
  return GET(new NextRequest(url));
};

describe("GET /api/products/suggest", () => {
  it("trả suggestions gồm slug, name, price, inStock", async () => {
    const res = await call("ban phim");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.suggestions).toHaveLength(1);
    expect(Object.keys(body.suggestions[0]).sort()).toEqual(["inStock", "name", "price", "slug"]);
  });

  it("không có kết quả vẫn 200 và mảng rỗng", async () => {
    const res = await call("xyz");
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ suggestions: [] });
  });

  it("từ khóa 1 ký tự trả 400 VALIDATION_ERROR", async () => {
    const res = await call("a");
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("thiếu q trả 400 VALIDATION_ERROR", async () => {
    const res = await call();
    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("51 ký tự trả 400, 50 ký tự trả 200", async () => {
    expect((await call("a".repeat(51))).status).toBe(400);
    expect((await call("a".repeat(50))).status).toBe(200);
  });

  it("ký tự đặc biệt trả 200 + rỗng ngay, không 500", async () => {
    for (const q of ["tai(", "(.*.*)*!", "[a", "\\\\", ".*", "a+"]) {
      const start = performance.now();
      const res = await call(q);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ suggestions: [] });
      expect(performance.now() - start).toBeLessThan(100);
    }
  });

  it("usb: còn hàng trước, hết hàng có inStock false", async () => {
    const { suggestions } = await (await call("usb")).json();
    expect(suggestions.map((s: { name: string }) => s.name)).toEqual([
      "Cáp USB-C bện dù 2m",
      "Micro thu âm PodCast USB",
    ]);
    expect(suggestions[1].inStock).toBe(false);
  });
});
