// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { OrderError } from "./order-errors";
import { transitionOrder, type TransitionActor } from "./order-transitions";
import { deepFreeze, ORDER_STATUSES, type Order, type OrderStatus } from "./types";

const NOW = new Date("2026-10-22T05:00:00.000Z");

const orderWith = (status: OrderStatus): Order => ({
  id: "SL-1",
  status,
  createdAt: "2026-10-21T03:00:00.000Z",
  updatedAt: "2026-10-21T03:00:00.000Z",
  customer: { fullName: "A", phone: "0900000000", address: "1 A, B, C" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [
    {
      productId: "p1",
      slug: "p1",
      name: "P1",
      image: { emoji: "x", from: "a", to: "b" },
      unitPrice: 1,
      quantity: 3,
      lineTotal: 3,
    },
  ],
  subtotal: 0,
  shippingFee: 0,
  total: 0,
});

const ALLOWED: Record<TransitionActor, [OrderStatus, OrderStatus][]> = {
  staff: [
    ["pending", "confirmed"],
    ["pending", "cancelled"],
    ["confirmed", "shipping"],
    ["confirmed", "cancelled"],
    ["shipping", "delivered"],
  ],
  customer: [["pending", "cancelled"]],
};

describe("transitionOrder", () => {
  it("trả đối tượng mới, đổi status và updatedAt, không sửa đầu vào đã đóng băng sâu", () => {
    const input = deepFreeze(orderWith("pending"));
    const next = transitionOrder(input, { actor: "staff", to: "confirmed" }, NOW);
    expect(next).not.toBe(input);
    expect(next).toEqual({
      ...input,
      status: "confirmed",
      updatedAt: NOW.toISOString(),
      statusHistory: [
        { status: "pending", at: input.createdAt },
        { status: "confirmed", at: NOW.toISOString() },
      ],
    });
    expect(input.status).toBe("pending");
  });

  for (const actor of ["staff", "customer"] as const) {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES) {
        const ok = ALLOWED[actor].some(([f, t]) => f === from && t === to);
        it(`${actor}: ${from} -> ${to} ${ok ? "thành công" : "bị 409 INVALID_STATUS_TRANSITION"}`, () => {
          const run = () =>
            transitionOrder(
              orderWith(from),
              {
                actor,
                to,
                reason: actor === "staff" ? "out_of_stock" : undefined,
                productId: "p1",
              },
              NOW,
            );
          if (ok) return expect(run().status).toBe(to);
          expect(run).toThrow(OrderError);
          try {
            run();
          } catch (error) {
            expect((error as OrderError).code).toBe("INVALID_STATUS_TRANSITION");
            expect((error as OrderError).httpStatus).toBe(409);
          }
        });
      }
    }
  }

  it("Báo thiếu hàng ghi stockAdjustment của dòng bị báo; thiếu/lạ productId hoặc lý do khác: VALIDATION_ERROR", () => {
    const order = orderWith("confirmed");
    const next = transitionOrder(
      order,
      { actor: "staff", to: "cancelled", reason: "out_of_stock", productId: "p1" },
      NOW,
    );
    expect(next).toMatchObject({
      cancelledBy: "staff",
      cancelReason: "out_of_stock",
      stockAdjustment: { productId: "p1", quantity: 3 },
    });
    for (const bad of [
      { reason: "out_of_stock" as const },
      { reason: "out_of_stock" as const, productId: "zz" },
      { reason: "unreachable" as const, productId: "p1" },
    ]) {
      expect(() =>
        transitionOrder(order, { actor: "staff", to: "cancelled", ...bad }, NOW),
      ).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
    }
    // Từ chối đơn pending không ghi Điều chỉnh tồn
    expect(
      transitionOrder(
        orderWith("pending"),
        { actor: "staff", to: "cancelled", reason: "out_of_stock" },
        NOW,
      ),
    ).not.toHaveProperty("stockAdjustment");
  });

  it("test tĩnh: chỉ order-transitions.ts gán status khác pending trong orders/*.ts", () => {
    const dir = path.join(process.cwd(), "src/features/orders");
    const files = readdirSync(dir).filter(
      (f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && f !== "types.ts",
    );
    const assign = /\bstatus:\s*["'`](?!pending["'`])\w+/;
    const offenders = files.filter(
      (f) => f !== "order-transitions.ts" && assign.test(readFileSync(path.join(dir, f), "utf8")),
    );
    expect(offenders).toEqual([]);
    expect(readFileSync(path.join(dir, "order-transitions.ts"), "utf8")).toMatch(
      /\.\.\.order,\s*status/,
    );
  });
});
