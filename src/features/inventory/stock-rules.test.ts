import { describe, expect, it } from "vitest";
import {
  clampStock,
  computeCurrentStock,
  computeCurrentStocks,
  getConsumptionByProduct,
  type StockOrder,
} from "./stock-rules";

const order = (status: string, quantity: number, productId = "p1"): StockOrder => ({
  status,
  items: [{ productId, quantity }],
});

describe("computeCurrentStock", () => {
  const base = { id: "p1", stock: 5 };

  it("chỉ trừ đơn confirmed/shipping/delivered, đơn pending không giữ kho", () => {
    expect(computeCurrentStock(base, [order("confirmed", 2), order("pending", 3)])).toBe(3);
    expect(computeCurrentStock(base, [order("shipping", 2)])).toBe(3);
    expect(computeCurrentStock(base, [order("delivered", 2)])).toBe(3);
  });

  it("đơn confirmed chuyển sang cancelled thì tồn về lại; shipping/delivered không đổi thêm", () => {
    expect(computeCurrentStock(base, [order("cancelled", 2)])).toBe(5);
    expect(computeCurrentStock(base, [order("confirmed", 2)])).toBe(3);
    expect(computeCurrentStock(base, [order("delivered", 2)])).toBe(3);
  });

  it("đơn cancelled có điều chỉnh tồn thì trừ thêm, điều chỉnh sản phẩm khác không ảnh hưởng", () => {
    const cancelled = (productId: string): StockOrder => ({
      ...order("cancelled", 2),
      stockAdjustment: { productId, quantity: 2 },
    });
    expect(computeCurrentStock(base, [cancelled("p1")])).toBe(3);
    expect(computeCurrentStock(base, [cancelled("p2")])).toBe(5);
  });

  it("chỉ trừ đúng sản phẩm đang tính, nhiều dòng cùng đơn", () => {
    const multi: StockOrder = {
      status: "confirmed",
      items: [
        { productId: "p1", quantity: 1 },
        { productId: "p2", quantity: 4 },
      ],
    };
    expect(computeCurrentStock(base, [multi])).toBe(4);
  });

  it("sản phẩm không còn trong catalog (Tồn gốc 0) cho giá trị thô âm, chỉ biên mới chặn 0", () => {
    const raw = computeCurrentStock({ id: "cu", stock: 0 }, [order("confirmed", 2, "cu")]);
    expect(raw).toBe(-2);
    expect(clampStock(raw)).toBe(0);
    expect(clampStock(3)).toBe(3);
  });
});

describe("hiệu năng với 36.000 đơn (NFR3)", () => {
  const orders = Array.from({ length: 36_000 }, (_, i) =>
    order(["pending", "confirmed", "shipping", "delivered", "cancelled"][i % 5], 1, `p${i % 20}`),
  );
  const bases = Array.from({ length: 20 }, (_, i) => ({ id: `p${i}`, stock: 100_000 }));

  it("một sản phẩm dưới 200 ms", () => {
    const start = performance.now();
    computeCurrentStock(bases[0], orders);
    expect(performance.now() - start).toBeLessThan(200);
  });

  it("toàn catalog trong một lượt quét dưới 200 ms và khớp từng sản phẩm", () => {
    const start = performance.now();
    const all = computeCurrentStocks(bases, orders);
    expect(performance.now() - start).toBeLessThan(200);
    expect(all.get("p0")).toBe(computeCurrentStock(bases[0], orders));
    expect(getConsumptionByProduct(orders).size).toBeGreaterThan(0);
  });
});
