import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./sanitize-next";

describe("sanitizeNext", () => {
  it("giữ nguyên đường dẫn quản trị hợp lệ", () => {
    expect(sanitizeNext("/admin/orders/SL-1")).toBe("/admin/orders/SL-1");
    expect(sanitizeNext("/admin")).toBe("/admin");
  });

  it.each([
    "//evil.com",
    "/admin//evil.com",
    "/orders",
    "/administrator",
    "https://x.com",
    "",
    undefined,
  ])("về /admin khi giá trị không hợp lệ: %s", (raw) => {
    expect(sanitizeNext(raw)).toBe("/admin");
  });
});
