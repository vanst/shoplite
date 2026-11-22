import { describe, expect, it } from "vitest";
import { products } from "@/data/products";
import type { Order } from "@/features/orders/types";
import { computeOrderMetrics } from "./order-metrics";

const H = 3600_000;
const T0 = Date.parse("2026-11-01T00:00:00.000Z");
const at = (ms: number) => new Date(T0 + ms).toISOString();
const item = (productId: string, quantity: number) =>
  ({ productId, quantity }) as Order["items"][number];

const o = (id: string, extra: Partial<Order>): Order => ({
  id,
  status: "pending",
  createdAt: at(0),
  updatedAt: at(0),
  customer: { fullName: "A", phone: "0900000000", address: "1 A, B, C" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [],
  subtotal: 0,
  shippingFee: 0,
  total: 0,
  ...extra,
});
const hist = (...e: [Order["status"], number][]) => e.map(([status, t]) => ({ status, at: at(t) }));

describe("computeOrderMetrics", () => {
  const stock = products[0].stock;
  const orders = [
    // Xác nhận sau 1 giờ, vượt tồn gốc của sản phẩm đầu tiên
    o("1", {
      status: "confirmed",
      items: [item(products[0].id, stock + 1)],
      statusHistory: hist(["pending", 0], ["confirmed", H]),
    }),
    // Xác nhận sau 3 giờ
    o("2", {
      status: "delivered",
      statusHistory: hist(["pending", 0], ["confirmed", 3 * H], ["delivered", 5 * H]),
    }),
    // Từ chối Hết hàng sau 5 giờ (trượt SLA)
    o("3", {
      status: "cancelled",
      cancelledBy: "staff",
      cancelReason: "out_of_stock",
      statusHistory: hist(["pending", 0], ["cancelled", 5 * H]),
    }),
    // Báo thiếu hàng: xác nhận 1 giờ rồi hủy Hết hàng
    o("4", {
      status: "cancelled",
      cancelledBy: "staff",
      cancelReason: "out_of_stock",
      statusHistory: hist(["pending", 0], ["confirmed", H], ["cancelled", 2 * H]),
    }),
    o("5", {
      status: "cancelled",
      cancelledBy: "staff",
      cancelReason: "unreachable",
      statusHistory: hist(["pending", 0], ["cancelled", H]),
    }),
    // Khách tự hủy và đơn cũ không rõ người hủy: không vào SM-1, SM-C1, SM-4
    o("6", { status: "cancelled", cancelledBy: "customer", updatedAt: at(H) }),
    o("7", { status: "cancelled", updatedAt: at(H) }),
    // pending quá 4 giờ: trượt SLA
    o("8", {}),
  ];

  it("tính SM-1, SM-C1, SM-2, SM-4, SM-C3 trên bộ đơn mẫu", () => {
    const m = computeOrderMetrics(orders, new Date(T0 + 10 * H));
    expect(m.totalOrders).toBe(8);
    expect(m.sm1).toBe(2 / 8);
    expect(m.smC1).toBe(1 / 8);
    expect(m.sm2).toBe(1);
    // đủ điều kiện: 1,2,3,4,5,8; đúng hạn: 1,2,4,5
    expect(m.sm4).toBe(4 / 6);
    // xác nhận sau 1h, 3h, 1h -> trung vị 1h
    expect(m.smC3Ms).toBe(H);
  });

  it("pending chưa quá 4 giờ chưa tính vào SM-4; không có đơn thì trả null", () => {
    expect(computeOrderMetrics([o("8", {})], new Date(T0 + H)).sm4).toBeNull();
    const empty = computeOrderMetrics([], new Date(T0));
    expect(empty).toMatchObject({ sm1: null, smC1: null, sm2: 0, sm4: null, smC3Ms: null });
  });
});
