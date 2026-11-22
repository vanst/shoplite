import { describe, expect, it } from "vitest";
import { getClientKey } from "./client-key";

const req = (headers: Record<string, string> = {}) => new Request("http://localhost/", { headers });

describe("getClientKey", () => {
  it("lấy phần tử ngoài cùng bên phải và bỏ khoảng trắng thừa", () => {
    expect(getClientKey(req({ "x-forwarded-for": "1.1.1.1,  2.2.2.2 " }))).toBe("2.2.2.2");
    expect(getClientKey(req({ "x-forwarded-for": "3.3.3.3" }))).toBe("3.3.3.3");
  });

  it("thiếu hoặc rỗng thì direct", () => {
    expect(getClientKey(req())).toBe("direct");
    expect(getClientKey(req({ "x-forwarded-for": "" }))).toBe("direct");
    expect(getClientKey(req({ "x-forwarded-for": "1.1.1.1, " }))).toBe("direct");
  });
});
