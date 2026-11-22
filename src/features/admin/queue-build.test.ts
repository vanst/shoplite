import { describe, expect, it } from "vitest";
import { deepFreeze, type OrderStatus, type StoredOrder } from "@/features/orders/types";
import {
  PENDING_SLA_MS,
  buildQueue,
  getPendingQuantities,
  getPendingQuantity,
  isOverdue,
  toQueueRow,
} from "./queue-rules";

const CREATED = "2026-10-21T00:00:00.000Z";
const t = (h: number) => new Date(Date.parse(CREATED) + h * 3_600_000).toISOString();

describe("isOverdue", () => {
  const pending = { status: "pending", createdAt: CREATED } as const;
  it("đúng 4 giờ chưa quá hạn, thêm 1ms thì quá hạn", () => {
    expect(isOverdue(pending, new Date(Date.parse(CREATED) + PENDING_SLA_MS))).toBe(false);
    expect(isOverdue(pending, new Date(Date.parse(CREATED) + PENDING_SLA_MS + 1))).toBe(true);
  });
  it("đặt 21:00, 01:00:00 hôm sau chưa đỏ, 01:00:01 đỏ (ISO UTC, không phụ thuộc múi giờ)", () => {
    const order = { status: "pending", createdAt: "2026-10-20T21:00:00.000Z" } as const;
    expect(isOverdue(order, new Date("2026-10-21T01:00:00.000Z"))).toBe(false);
    expect(isOverdue(order, new Date("2026-10-21T01:00:01.000Z"))).toBe(true);
  });
  it("đơn không pending không bao giờ quá hạn", () => {
    expect(isOverdue({ ...pending, status: "confirmed" }, new Date(t(1000)))).toBe(false);
  });
});

function makeOrder(id: string, status: OrderStatus, createdAt: string, updatedAt = createdAt) {
  return deepFreeze({
    id,
    status,
    createdAt,
    updatedAt,
    customer: { fullName: "Nguyễn Văn A", phone: "0912345678", address: "1 Trần Phú" },
    shippingMethod: "standard",
    paymentMethod: "cod",
    items: [
      { productId: "p1", quantity: 2 },
      { productId: "p2", quantity: 3 },
    ],
    subtotal: 1,
    shippingFee: 0,
    total: 123_000,
  }) as unknown as StoredOrder;
}

describe("toQueueRow", () => {
  it("dựng đủ trường; itemCount là tổng số lượng; ageLabel chỉ cho pending", () => {
    const now = new Date(t(1.1));
    expect(toQueueRow(makeOrder("A", "pending", CREATED), now)).toMatchObject({
      id: "A",
      status: "pending",
      customerName: "Nguyễn Văn A",
      itemCount: 5,
      total: 123_000,
      ageLabel: "Chờ 1 giờ",
      overdue: false,
    });
    expect(toQueueRow(makeOrder("B", "shipping", CREATED), now).ageLabel).toBeUndefined();
  });
});

describe("toQueueRow - nhãn người hủy (Story 5.4)", () => {
  const now = new Date(t(1));
  const cancelled = (extra: Record<string, unknown>) =>
    deepFreeze({ ...makeOrder("X", "cancelled", CREATED), ...extra }) as unknown as StoredOrder;

  it.each([
    [{ cancelledBy: "staff", cancelReason: "out_of_stock" }, "Từ chối · Hết hàng"],
    [{ cancelledBy: "staff", cancelReason: "customer_cancelled" }, "Từ chối · Khách hủy"],
    [{ cancelledBy: "customer" }, "Khách tự hủy"],
    [{}, undefined],
  ])("đơn hủy %j -> %s", (extra, label) => {
    expect(toQueueRow(cancelled(extra), now).cancelLabel).toBe(label);
  });

  it("đơn không hủy không có nhãn", () => {
    expect(toQueueRow(makeOrder("A", "delivered", CREATED), now).cancelLabel).toBeUndefined();
  });
});

describe("buildQueue", () => {
  const now = new Date(t(10));
  const orders = [
    makeOrder("P-new", "pending", t(9)),
    makeOrder("P-old-late", "pending", t(1)),
    makeOrder("P-mid-late", "pending", t(2)),
    makeOrder("P-mid-ok", "pending", t(7)),
    makeOrder("C2", "confirmed", t(4)),
    makeOrder("C1", "confirmed", t(3)),
    makeOrder("S2", "shipping", t(6)),
    makeOrder("S1", "shipping", t(5)),
    makeOrder("D-old", "delivered", t(1), t(2)),
    makeOrder("X-new", "cancelled", t(1), t(8)),
  ];
  const ids = (rows: { id: string }[]) => rows.map((r) => r.id);

  it("pending: quá hạn lên trước, mỗi phần cũ nhất trước", () => {
    expect(ids(buildQueue(orders, now).pending.rows)).toEqual([
      "P-old-late",
      "P-mid-late",
      "P-mid-ok",
      "P-new",
    ]);
  });
  it("confirmed và shipping tăng dần theo giờ đặt", () => {
    const q = buildQueue(orders, now);
    expect(ids(q.confirmed.rows)).toEqual(["C1", "C2"]);
    expect(ids(q.shipping.rows)).toEqual(["S1", "S2"]);
  });
  it("done: updatedAt mới nhất trước, cắt 50 nhưng đếm tổng", () => {
    expect(ids(buildQueue(orders, now).done.rows)).toEqual(["X-new", "D-old"]);
    const many = Array.from({ length: 55 }, (_, i) =>
      makeOrder(`D${i}`, "delivered", t(0), t(1 + i / 100)),
    );
    const done = buildQueue(many, now).done;
    expect(done.count).toBe(55);
    expect(done.rows).toHaveLength(50);
    expect(done.rows[0].id).toBe("D54");
  });
  it("số đếm từng nhóm; đầu vào đóng băng không bị sửa", () => {
    const q = buildQueue(orders, now);
    expect(Object.values(q).map((g) => g.count)).toEqual([4, 2, 2, 2]);
    expect(orders[0].id).toBe("P-new");
  });
});

describe("buildQueue - đơn tồn đọng (Story 4.8)", () => {
  it("11 đơn cũ hơn 4 giờ đều quá hạn và nằm trên đơn mới; số đếm đủ 12", () => {
    const now = new Date(t(100));
    const old = Array.from({ length: 11 }, (_, i) => makeOrder(`O${i}`, "pending", t(i)));
    const q = buildQueue([makeOrder("NEW", "pending", t(99)), ...old], now);
    expect(q.pending.count).toBe(12);
    expect(q.pending.rows.slice(0, 11).every((r) => r.overdue)).toBe(true);
    expect(q.pending.rows[11]).toMatchObject({ id: "NEW", overdue: false });
  });
});

describe("getPendingQuantity", () => {
  const withItems = (id: string, status: OrderStatus, items: [string, number][]) => ({
    id,
    status,
    items: items.map(([productId, quantity]) => ({ productId, quantity })),
  });
  const orders = [
    withItems("A", "pending", [["p1", 2]]),
    withItems("B", "pending", [
      ["p1", 1],
      ["p2", 4],
    ]),
    withItems("C", "confirmed", [["p1", 9]]),
    withItems("D", "shipping", [["p1", 9]]),
    withItems("E", "delivered", [["p1", 9]]),
    withItems("F", "cancelled", [["p1", 9]]),
  ] as unknown as StoredOrder[];

  it("xem A trả 1, xem B trả 2; chỉ tính pending khác và đúng sản phẩm", () => {
    expect(getPendingQuantity(orders, "p1", "A")).toBe(1);
    expect(getPendingQuantity(orders, "p1", "B")).toBe(2);
    expect(getPendingQuantity(orders, "p3", "A")).toBe(0);
  });
  it("một lượt cho nhiều món", () => {
    expect(getPendingQuantities(orders, ["p1", "p2"], "A")).toEqual({ p1: 1, p2: 4 });
  });
});
