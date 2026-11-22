import { describe, expect, it } from "vitest";
import { OrderError } from "@/features/orders/order-errors";
import { canonicalOrderId } from "./order-id";

describe("canonicalOrderId", () => {
  it("trim, bỏ khoảng trắng, in hoa", () => {
    expect(canonicalOrderId(" sl-20261121-a1b2c3 ")).toBe("SL-20261121-A1B2C3");
    expect(canonicalOrderId("SL-20261121- A1B2C3")).toBe("SL-20261121-A1B2C3");
  });

  it("chuỗi rỗng trả chuỗi rỗng", () => {
    expect(canonicalOrderId("")).toBe("");
  });

  it("dài hơn 32 ký tự thì ném VALIDATION_ERROR", () => {
    expect(canonicalOrderId("A".repeat(32))).toHaveLength(32);
    const act = () => canonicalOrderId("A".repeat(33));
    expect(act).toThrow(OrderError);
    expect(act).toThrow(expect.objectContaining({ code: "VALIDATION_ERROR" }));
  });
});
