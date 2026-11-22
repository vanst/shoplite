// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getCatalogProducts } from "@/features/catalog/catalog-data";
import type { Product } from "@/features/catalog/types";
import { createInMemoryOrderRepository } from "@/features/orders/order-repository";
import type { Order } from "@/features/orders/types";
import { createInventoryService } from "./inventory-service";

const [template] = getCatalogProducts();
const product = (id: string, slug: string, stock: number): Product => ({
  ...template,
  id,
  slug,
  stock,
});

const order = (
  id: string,
  status: Order["status"],
  productId: string,
  quantity: number,
): Order => ({
  id,
  status,
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  customer: { fullName: "A", phone: "0356789012", address: "x" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [
    {
      productId,
      slug: "x",
      name: "x",
      image: template.image,
      unitPrice: 1,
      quantity,
      lineTotal: quantity,
    },
  ],
  subtotal: quantity,
  shippingFee: 0,
  total: quantity,
});

async function setup(orders: Order[]) {
  const repository = createInMemoryOrderRepository();
  for (const o of orders) await repository.save(o);
  const base = [product("a", "a", 5), product("b", "b", 10), product("c", "c", 3)];
  return createInventoryService({ repository, getBaseProducts: () => base });
}

describe("inventoryService", () => {
  it("Tồn gốc 5 và đơn confirmed số lượng 2 thì Tồn hiện tại 3; pending và cancelled không trừ", async () => {
    const service = await setup([
      order("1", "confirmed", "a", 2),
      order("2", "pending", "a", 3),
      order("3", "cancelled", "b", 4),
    ]);
    const stocks = Object.fromEntries(
      (await service.getStockedProducts()).map((p) => [p.id, p.stock]),
    );
    expect(stocks).toEqual({ a: 3, b: 10, c: 3 });
  });

  it("chặn tồn âm về 0 và Tồn gốc lớn hơn 0 vẫn về 0 khi đã bán hết", async () => {
    const service = await setup([order("1", "delivered", "c", 7)]);
    expect((await service.getStockedProductBySlug("c"))?.stock).toBe(0);
  });

  it("getStockedProductBySlug trả undefined khi slug không tồn tại", async () => {
    const service = await setup([]);
    expect(await service.getStockedProductBySlug("khong-co")).toBeUndefined();
  });

  it("withCurrentStock phủ tồn lên danh sách bất kỳ, không sửa đối tượng gốc", async () => {
    const service = await setup([order("1", "confirmed", "a", 2)]);
    const input = [product("a", "a", 5)];
    const [out] = await service.withCurrentStock(input);
    expect(out.stock).toBe(3);
    expect(input[0].stock).toBe(5);
  });

  it("đơn có sản phẩm đã gỡ khỏi catalog không gây lỗi và không ảnh hưởng sản phẩm khác", async () => {
    const service = await setup([
      order("1", "confirmed", "da-go", 9),
      order("2", "confirmed", "a", 1),
    ]);
    const stocks = (await service.getStockedProducts()).map((p) => p.stock);
    expect(stocks).toEqual([4, 10, 3]);
  });

  it("getRawStockFor: confirmed trừ đúng, pending/cancelled không trừ, giá trị thô âm, ngoài catalog = 0", async () => {
    const service = await setup([
      order("1", "confirmed", "a", 2),
      order("2", "pending", "a", 3),
      order("3", "cancelled", "b", 4),
      order("4", "confirmed", "c", 5),
    ]);
    expect(await service.getRawStockFor(["a", "b", "c", "gone"])).toEqual({
      a: 3,
      b: 10,
      c: -2,
      gone: 0,
    });
  });
});
