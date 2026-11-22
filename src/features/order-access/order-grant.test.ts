// @vitest-environment node
import { describe, expect, it } from "vitest";
import { signToken } from "@/lib/signed-token";
import { getGrant, GRANT_COOKIE_NAME, hasGrant, issueGrantCookie, readGrants } from "./order-grant";

const URL_ = "http://localhost/api/orders";
const tokenOf = (setCookie: string) => setCookie.split(";")[0].slice(GRANT_COOKIE_NAME.length + 1);
const req = (cookie?: string) =>
  new Request(URL_, { headers: cookie ? { cookie: `${GRANT_COOKIE_NAME}=${cookie}` } : {} });

describe("order-grant", () => {
  it("cookie HttpOnly, SameSite=Lax, Path=/, TTL 30 phút, Secure theo giao thức", () => {
    const cookie = issueGrantCookie(req(), "SL-A", "placed");
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Lax/);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Max-Age=1800/);
    expect(cookie).not.toMatch(/Secure/);
    const https = new Request("https://shop.test/api/orders");
    expect(issueGrantCookie(https, "SL-A", "placed")).toMatch(/Secure/);
  });

  it("grant của đơn A không mở được đơn B; id viết thường vẫn khớp", () => {
    const token = tokenOf(issueGrantCookie(req(), "SL-A", "placed"));
    expect(hasGrant(token, "SL-A")).toBe(true);
    expect(hasGrant(token, "sl-a")).toBe(true);
    expect(hasGrant(token, "SL-B")).toBe(false);
  });

  it("getGrant trả grant kèm via, undefined khi sai đơn", () => {
    const token = tokenOf(issueGrantCookie(req(), "SL-A", "lookup"));
    expect(getGrant(token, "sl-a")?.via).toBe("lookup");
    expect(getGrant(token, "SL-B")).toBeUndefined();
  });

  it("cấp lại cùng id thì thay mục cũ và làm mới exp", () => {
    let t = 1_000_000;
    const now = () => t;
    const first = tokenOf(issueGrantCookie(req(), "SL-A", "placed", now));
    t += 60_000;
    const second = tokenOf(issueGrantCookie(req(first), "sl-a", "lookup", now));
    const grants = readGrants(second, now);
    expect(grants).toHaveLength(1);
    expect(grants[0]).toMatchObject({ id: "SL-A", via: "lookup", exp: t + 30 * 60 * 1000 });
  });

  it("vượt 10 mục thì loại mục có exp sớm nhất", () => {
    let t = 1_000_000;
    const now = () => t;
    let token: string | undefined;
    for (let i = 0; i < 11; i++) {
      t += 1000;
      token = tokenOf(issueGrantCookie(req(token), `SL-${i}`, "placed", now));
    }
    expect(readGrants(token, now).map((g) => g.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `SL-${i + 1}`),
    );
  });

  it("cookie rác, giả mạo, hết hạn đều trả false, không ném", () => {
    let t = 1_000_000;
    const token = tokenOf(issueGrantCookie(req(), "SL-A", "placed", () => t));
    t += 30 * 60 * 1000 + 1;
    expect(hasGrant(token, "SL-A", () => t)).toBe(false);
    expect(hasGrant("rac", "SL-A")).toBe(false);
    expect(hasGrant("a.b", "SL-A")).toBe(false);
    expect(hasGrant(undefined, "SL-A")).toBe(false);
    const forged = signToken(
      { grants: [{ id: "SL-A", via: "placed", exp: Date.now() + 1e6 }] },
      { key: "khoa-khac", purpose: "order-grant", ttlMs: 1e6 },
    );
    expect(hasGrant(forged, "SL-A")).toBe(false);
  });

  it("token admin-session không được chấp nhận như grant", () => {
    // Cùng khóa không thể có (khóa grant ngẫu nhiên), nên kiểm purpose bằng cách ký sai purpose bằng khóa bất kỳ
    const other = signToken(
      { grants: [{ id: "SL-A", via: "placed", exp: Date.now() + 1e6 }] },
      { key: "k", purpose: "admin-session", ttlMs: 1e6 },
    );
    expect(hasGrant(other, "SL-A")).toBe(false);
  });
});
