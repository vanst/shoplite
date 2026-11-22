import { describe, expect, it } from "vitest";
import { getPhoneLast4, NO_PHONE_LAST4, normalizePhone } from "./phone";

describe("normalizePhone", () => {
  it("đưa mọi dạng viết về cùng một chuỗi 0…", () => {
    const forms = ["0912345678", "+84912345678", "0912 345 678", "+84.912.345.678", "0912-345-678"];
    expect(new Set(forms.map(normalizePhone))).toEqual(new Set(["0912345678"]));
  });
});

describe("getPhoneLast4", () => {
  it("cùng 4 số cuối cho dạng 0… và +84…", () => {
    expect(getPhoneLast4("0912345678")).toBe("5678");
    expect(getPhoneLast4("+84912345678")).toBe("5678");
  });

  it("ít hơn 4 chữ số thì trả giá trị không khớp Mã xác minh hợp lệ nào", () => {
    expect(getPhoneLast4("12")).toBe(NO_PHONE_LAST4);
    expect(NO_PHONE_LAST4).not.toMatch(/^\d{4}$/);
  });
});
