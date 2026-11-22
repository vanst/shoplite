import { describe, expect, it } from "vitest";
import { getTimeline, getTimelineView } from "./order-timeline";
import { deepFreeze, type Order } from "./types";

const base: Order = {
  id: "SL-1",
  status: "pending",
  createdAt: "2026-10-21T03:00:00.000Z",
  updatedAt: "2026-10-21T03:00:00.000Z",
  customer: { fullName: "A", phone: "0900000000", address: "1 A, B, C" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [],
  subtotal: 0,
  shippingFee: 0,
  total: 0,
};

describe("getTimeline", () => {
  it("trả đúng lịch sử có sẵn theo thứ tự tăng dần, không sửa đầu vào đóng băng", () => {
    const input = deepFreeze({
      ...base,
      status: "confirmed" as const,
      statusHistory: [
        { status: "confirmed" as const, at: "2026-10-21T05:00:00.000Z" },
        { status: "pending" as const, at: "2026-10-21T03:00:00.000Z" },
      ],
    });
    expect(getTimeline(input).map((e) => e.status)).toEqual(["pending", "confirmed"]);
  });

  it("đơn cũ pending: một mốc từ createdAt", () => {
    expect(getTimeline(base)).toEqual([{ status: "pending", at: base.createdAt }]);
  });

  it.each(["cancelled", "confirmed", "shipping", "delivered"] as const)(
    "đơn cũ %s: thêm mốc hiện tại từ updatedAt",
    (status) => {
      const order = { ...base, status, updatedAt: "2026-10-22T00:00:00.000Z" };
      expect(getTimeline(order)).toEqual([
        { status: "pending", at: base.createdAt },
        { status, at: "2026-10-22T00:00:00.000Z" },
      ]);
    },
  );
});

describe("getTimelineView", () => {
  it("mốc đầu là Đặt hàng, các mốc sau là nhãn trạng thái", () => {
    const order = { ...base, status: "confirmed" as const, updatedAt: "2026-10-22T00:00:00.000Z" };
    expect(getTimelineView(order)).toEqual([
      { label: "Đặt hàng", at: base.createdAt },
      { label: "Đã xác nhận", at: "2026-10-22T00:00:00.000Z" },
    ]);
  });
});
