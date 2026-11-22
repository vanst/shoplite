// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { Order } from "@/features/orders/types";
import { verifyLookup } from "./verify-lookup";

const order = (phone: string) => ({ customer: { phone } }) as Order;

describe("verifyLookup", () => {
  it("khớp 4 số cuối của 0… và +84…", () => {
    expect(verifyLookup(order("0912345678"), "5678")).toBe(true);
    expect(verifyLookup(order("+84912345678"), "5678")).toBe(true);
  });

  it("sai Mã xác minh, đơn không tồn tại, hoặc SĐT quá ngắn thì false", () => {
    expect(verifyLookup(order("0912345678"), "0000")).toBe(false);
    expect(verifyLookup(undefined, "5678")).toBe(false);
    expect(verifyLookup(order("12"), "----")).toBe(false);
  });
});
