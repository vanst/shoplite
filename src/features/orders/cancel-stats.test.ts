import { describe, expect, it } from "vitest";
import { countCancellations } from "./cancel-stats";
import type { Order } from "./types";

const o = (extra: Partial<Order>): Order => ({
  id: "SL-1",
  status: "cancelled",
  createdAt: "2026-10-21T03:00:00.000Z",
  updatedAt: "2026-10-21T03:00:00.000Z",
  customer: { fullName: "A", phone: "0900000000", address: "1 A, B, C" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [],
  subtotal: 0,
  shippingFee: 0,
  total: 0,
  ...extra,
});

describe("countCancellations", () => {
  it("đếm riêng từng lý do Từ chối, Khách tự hủy và đơn cũ không rõ; bỏ qua đơn chưa hủy", () => {
    const stats = countCancellations([
      o({ cancelledBy: "staff", cancelReason: "out_of_stock" }),
      o({ cancelledBy: "staff", cancelReason: "out_of_stock" }),
      o({ cancelledBy: "staff", cancelReason: "unreachable" }),
      o({ cancelledBy: "staff", cancelReason: "customer_cancelled" }),
      o({ cancelledBy: "customer" }),
      o({}),
      o({ status: "pending" }),
    ]);
    expect(stats).toEqual({
      rejected: { out_of_stock: 2, customer_cancelled: 1, unreachable: 1 },
      customerCancelled: 1,
      unknown: 1,
    });
  });
});
