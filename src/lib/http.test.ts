// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { OrderError } from "@/features/orders/order-errors";
import { handleRouteError } from "./http";

describe("handleRouteError", () => {
  it("đặt Retry-After khi OrderError có details.retryAfterSeconds", async () => {
    const response = handleRouteError(
      new OrderError("TOO_MANY_ATTEMPTS", "Thử lại sau", { retryAfterSeconds: "42" }),
    );
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("42");
    expect((await response.json()).error).toMatchObject({
      code: "TOO_MANY_ATTEMPTS",
      details: { retryAfterSeconds: "42" },
    });
  });

  it("không có Retry-After cho lỗi khác", () => {
    const response = handleRouteError(new OrderError("ORDER_NOT_FOUND", "Không thấy"));
    expect(response.status).toBe(404);
    expect(response.headers.get("retry-after")).toBeNull();
  });

  it("lỗi không xác định thành 500 INTERNAL_ERROR", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const response = handleRouteError(new Error("x"));
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL_ERROR");
  });
});
