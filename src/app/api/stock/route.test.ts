// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { getCatalogProducts } from "@/features/catalog/catalog-data";
import type { StoredOrder } from "@/features/orders/types";

const findAll = vi.fn<() => Promise<StoredOrder[]>>();
vi.mock("@/features/orders/server", () => ({ orderRepository: { findAll: () => findAll() } }));

import { GET } from "./route";

describe("GET /api/stock", () => {
  it("trả Tồn hiện tại cho mọi sản phẩm, đã chặn >= 0, no-store", async () => {
    const [first, second] = getCatalogProducts();
    findAll.mockResolvedValue([
      {
        status: "confirmed",
        items: [{ productId: first.id, quantity: first.stock + 5 }],
      } as unknown as StoredOrder,
    ]);
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(Object.keys(body.stock)).toHaveLength(getCatalogProducts().length);
    expect(body.stock[first.id]).toBe(0);
    expect(body.stock[second.id]).toBe(second.stock);
    expect(Object.keys(body)).toEqual(["stock"]);
  });

  it("lỗi đọc đơn thành 500 INTERNAL_ERROR", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    findAll.mockRejectedValue(new Error("hỏng"));
    const response = await GET();
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL_ERROR");
  });
});
