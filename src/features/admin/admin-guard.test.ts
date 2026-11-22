// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

const { cookieStore } = vi.hoisted(() => ({
  cookieStore: { value: undefined as string | undefined },
}));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) =>
      name === "shoplite_admin" && cookieStore.value !== undefined
        ? { name, value: cookieStore.value }
        : undefined,
  }),
}));

import {
  assertAdminEnabled,
  checkAdminPassword,
  clearSessionCookie,
  createSessionCookie,
  getAdminSession,
  isAdminEnabled,
  requireAdmin,
  requireAdminApi,
} from "./admin-guard";

const request = new Request("http://localhost/api/admin/x");

/** Lấy giá trị cookie phiên từ chuỗi Set-Cookie. */
const tokenOf = (setCookie: string) => setCookie.split(";")[0].split("=").slice(1).join("=");
const withCookie = (value: string) =>
  new Request("http://localhost/api/admin/x", {
    headers: { cookie: `a=1; shoplite_admin=${value}` },
  });

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
  cookieStore.value = undefined;
});

describe("isAdminEnabled", () => {
  it("tắt khi biến thiếu hoặc rỗng, bật khi có giá trị", () => {
    vi.stubEnv("ADMIN_PASSWORD", undefined);
    expect(isAdminEnabled()).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(isAdminEnabled()).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    expect(isAdminEnabled()).toBe(true);
  });
});

describe("assertAdminEnabled", () => {
  it("gọi notFound khi chưa cấu hình, không làm gì khi đã cấu hình", () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(() => assertAdminEnabled()).toThrow("NEXT_NOT_FOUND");
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    expect(() => assertAdminEnabled()).not.toThrow();
  });
});

describe("checkAdminPassword", () => {
  it("chỉ chấp nhận đúng mật khẩu, kể cả khi khác độ dài hoặc rỗng", () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    expect(checkAdminPassword("abc")).toBe(true);
    expect(checkAdminPassword("abcd")).toBe(false);
    expect(checkAdminPassword("ab")).toBe(false);
    expect(checkAdminPassword("")).toBe(false);
  });

  it("luôn từ chối khi chưa cấu hình, kể cả mật khẩu rỗng", () => {
    vi.stubEnv("ADMIN_PASSWORD", undefined);
    expect(checkAdminPassword("")).toBe(false);
    vi.stubEnv("ADMIN_PASSWORD", "");
    expect(checkAdminPassword("")).toBe(false);
    expect(checkAdminPassword("abc")).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("gọi notFound khi chưa cấu hình", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    await expect(requireAdmin("/admin")).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("chuyển tới đăng nhập kèm next khi chưa có cookie hoặc cookie rác", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    await expect(requireAdmin("/admin")).rejects.toThrow(
      "NEXT_REDIRECT:/admin/login?next=%2Fadmin",
    );
    cookieStore.value = "rac";
    await expect(requireAdmin("/admin")).rejects.toThrow(
      "NEXT_REDIRECT:/admin/login?next=%2Fadmin",
    );
  });

  it("trả AdminContext khi cookie phiên hợp lệ", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    cookieStore.value = tokenOf(createSessionCookie(request));
    await expect(requireAdmin("/admin")).resolves.toBeDefined();
  });
});

describe("getAdminSession", () => {
  it("phân biệt không cookie, cookie rác và cookie hợp lệ", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    await expect(getAdminSession()).resolves.toBe("none");
    cookieStore.value = "rac";
    await expect(getAdminSession()).resolves.toBe("invalid");
    cookieStore.value = tokenOf(createSessionCookie(request));
    await expect(getAdminSession()).resolves.toBe("valid");
  });

  it("chưa cấu hình (thiếu hoặc rỗng) thì luôn là none, kể cả cookie ký lúc đã có mật khẩu", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    cookieStore.value = tokenOf(createSessionCookie(request));
    vi.stubEnv("ADMIN_PASSWORD", undefined);
    await expect(getAdminSession()).resolves.toBe("none");
    vi.stubEnv("ADMIN_PASSWORD", "");
    await expect(getAdminSession()).resolves.toBe("none");
  });
});

describe("requireAdminApi", () => {
  it("trả 404 thân rỗng khi chưa cấu hình", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    const response = (await requireAdminApi(request)) as Response;
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("trả 401 UNAUTHORIZED khi thiếu cookie hoặc cookie rác", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    for (const req of [request, withCookie("rac"), withCookie("a.b"), withCookie("")]) {
      const response = (await requireAdminApi(req)) as Response;
      expect(response.status).toBe(401);
      expect((await response.json()).error.code).toBe("UNAUTHORIZED");
    }
  });

  it("trả AdminContext khi cookie phiên hợp lệ", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    const ctx = await requireAdminApi(withCookie(tokenOf(createSessionCookie(request))));
    expect(ctx instanceof Response).toBe(false);
  });

  it("đổi mật khẩu làm cookie cũ mất hiệu lực", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    const old = tokenOf(createSessionCookie(request));
    vi.stubEnv("ADMIN_PASSWORD", "xyz");
    expect(((await requireAdminApi(withCookie(old))) as Response).status).toBe(401);
  });

  it("cookie hết hạn sau đúng 12 giờ", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    const token = tokenOf(createSessionCookie(request));
    vi.setSystemTime(new Date("2026-01-01T11:59:59Z"));
    expect(await requireAdminApi(withCookie(token))).not.toBeInstanceOf(Response);
    vi.setSystemTime(new Date("2026-01-01T12:00:00Z"));
    expect(await requireAdminApi(withCookie(token))).toBeInstanceOf(Response);
  });
});

describe("cookie phiên", () => {
  it("có đủ cờ và Secure chỉ khi https hoặc x-forwarded-proto https", () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    const http = createSessionCookie(request);
    expect(http).toMatch(/Path=\/; Expires=.+; Max-Age=43200; HttpOnly; SameSite=Lax$/);
    expect(http).not.toContain("Secure");
    const https = createSessionCookie(new Request("https://shop.vn/x"));
    expect(https).toContain("; Secure");
    const proxied = createSessionCookie(
      new Request("http://localhost/x", { headers: { "x-forwarded-proto": "https, http" } }),
    );
    expect(proxied).toContain("; Secure");
  });

  it("cookie xóa có giá trị rỗng và hết hạn trong quá khứ", () => {
    const cleared = clearSessionCookie(request);
    expect(cleared).toContain("shoplite_admin=;");
    expect(cleared).toContain("Max-Age=0");
    expect(cleared).toContain("Expires=Thu, 01 Jan 1970");
  });
});
