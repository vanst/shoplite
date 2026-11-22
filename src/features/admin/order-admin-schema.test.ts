import { describe, expect, it } from "vitest";
import { toFieldErrors } from "@/features/checkout/checkout-schema";
import { CANCEL_REASONS, ORDER_STATUSES } from "@/features/orders/types";
import { staffTransitionSchema } from "./order-admin-schema";

const errorsOf = (input: unknown) => {
  const result = staffTransitionSchema.safeParse(input);
  expect(result.success).toBe(false);
  return result.success ? {} : toFieldErrors(result.error);
};

describe("staffTransitionSchema", () => {
  it("hợp lệ với mọi cặp from/to thuộc ORDER_STATUSES trừ cancelled (cần reason; tính hợp lệ của cặp thuộc về service)", () => {
    for (const from of ORDER_STATUSES) {
      for (const to of ORDER_STATUSES.filter((s) => s !== "cancelled")) {
        expect(staffTransitionSchema.safeParse({ from, to }).success).toBe(true);
      }
    }
  });

  it("thiếu from: lỗi theo trường from", () => {
    expect(errorsOf({ to: "confirmed" })).toEqual({ from: expect.any(String) });
  });

  it("thiếu to hoặc to ngoài danh sách: lỗi theo trường to", () => {
    expect(errorsOf({ from: "pending" })).toHaveProperty("to");
    expect(errorsOf({ from: "pending", to: "rejected" })).toHaveProperty("to");
  });

  it("from ngoài danh sách: lỗi theo trường from", () => {
    expect(errorsOf({ from: "rejected", to: "confirmed" })).toHaveProperty("from");
  });

  it("to cancelled: reason bắt buộc và thuộc ba mã cố định", () => {
    expect(errorsOf({ from: "pending", to: "cancelled" })).toHaveProperty("reason");
    expect(errorsOf({ from: "pending", to: "cancelled", reason: "khac" })).toHaveProperty("reason");
    for (const reason of CANCEL_REASONS) {
      expect(staffTransitionSchema.parse({ from: "pending", to: "cancelled", reason })).toEqual({
        from: "pending",
        to: "cancelled",
        reason,
      });
    }
  });

  it("Báo thiếu hàng: confirmed -> cancelled cần reason out_of_stock và productId", () => {
    const ok = { from: "confirmed", to: "cancelled", reason: "out_of_stock", productId: "p010" };
    expect(staffTransitionSchema.parse(ok)).toEqual(ok);
    expect(errorsOf({ ...ok, productId: undefined })).toHaveProperty("productId");
    expect(errorsOf({ ...ok, productId: "" })).toHaveProperty("productId");
    expect(errorsOf({ ...ok, reason: "unreachable" })).toHaveProperty("reason");
    expect(errorsOf({ from: "confirmed", to: "cancelled" })).toHaveProperty("reason");
  });

  it("Từ chối từ trạng thái khác vẫn chỉ cần reason, productId lạ bị bỏ", () => {
    expect(
      staffTransitionSchema.parse({
        from: "pending",
        to: "cancelled",
        reason: "unreachable",
        productId: "x",
      }),
    ).toEqual({ from: "pending", to: "cancelled", reason: "unreachable" });
  });

  it("body không phải object: lỗi, không ném", () => {
    for (const input of [null, "x", 1, []])
      expect(staffTransitionSchema.safeParse(input).success).toBe(false);
  });

  it("trường tiền/tồn bị bỏ khỏi kết quả (AD-8)", () => {
    const result = staffTransitionSchema.parse({
      from: "pending",
      to: "confirmed",
      total: 1,
      unitPrice: 1,
      stock: 999,
    });
    expect(result).toEqual({ from: "pending", to: "confirmed" });
  });
});
