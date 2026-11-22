// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

vi.mock("@/features/admin/admin-guard", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/admin/admin-guard")>();
  return { ...actual, checkAdminPassword: vi.fn(actual.checkAdminPassword) };
});

import { checkAdminPassword } from "@/features/admin/admin-guard";
import { LOGIN_LOCKED_MESSAGE } from "@/features/admin/admin-messages";
import { POST } from "./route";

const PASSWORD = "mat-khau-bi-mat";

// Mỗi test dùng một IP riêng để bộ giới hạn (singleton cấp tiến trình) không rò giữa các test
let testIp = 0;
let currentIp = "";

function login(body: unknown, init: { url?: string; headers?: Record<string, string> } = {}) {
  return POST(
    new Request(init.url ?? "http://localhost/api/admin/login", {
      method: "POST",
      headers: { "x-forwarded-for": currentIp, ...init.headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
}

beforeEach(() => {
  currentIp = `10.0.0.${++testIp}`;
  vi.mocked(checkAdminPassword).mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/admin/login", () => {
  it("đúng mật khẩu thì 204 kèm cookie đủ cờ, không Secure trên HTTP", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    const response = await login({ password: PASSWORD });
    expect(response.status).toBe(204);
    const cookie = response.headers.get("set-cookie") ?? "";
    expect(cookie).toMatch(/^shoplite_admin=[^;]+; Path=\//);
    expect(cookie).toMatch(/HttpOnly; SameSite=Lax/);
    expect(cookie).toContain("Max-Age=43200");
    expect(cookie).not.toContain("Secure");
  });

  it("bật Secure khi URL https hoặc x-forwarded-proto https", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    const a = await login({ password: PASSWORD }, { url: "https://shop.vn/api/admin/login" });
    expect(a.headers.get("set-cookie")).toContain("; Secure");
    const b = await login({ password: PASSWORD }, { headers: { "x-forwarded-proto": "https" } });
    expect(b.headers.get("set-cookie")).toContain("; Secure");
  });

  it("mật khẩu sai, rỗng hoặc khác độ dài thì 401 và không đặt cookie", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    for (const password of ["sai", "", `${PASSWORD}x`]) {
      const response = await login({ password });
      expect(response.status).toBe(401);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect((await response.json()).error).toMatchObject({
        code: "UNAUTHORIZED",
        message: "Mật khẩu không đúng",
      });
    }
  });

  it("body xấu thì 400 VALIDATION_ERROR và không đặt cookie", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    for (const body of ["không phải json", {}, { password: 123 }, null, { password: null }]) {
      const response = await login(body);
      expect(response.status).toBe(400);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("chưa cấu hình thì 404 thân rỗng, kể cả đúng mật khẩu giả định", async () => {
    for (const value of [undefined, ""]) {
      vi.stubEnv("ADMIN_PASSWORD", value);
      const response = await login({ password: "" });
      expect(response.status).toBe(404);
      expect(await response.text()).toBe("");
      expect(response.headers.get("set-cookie")).toBeNull();
    }
  });

  it("không rò mật khẩu qua body response hay console", async () => {
    vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
    const spies = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation(() => {}),
    );
    const responses = [await login({ password: PASSWORD }), await login({ password: "sai" })];
    for (const response of responses) expect(await response.text()).not.toContain(PASSWORD);
    for (const spy of spies) expect(JSON.stringify(spy.mock.calls)).not.toContain(PASSWORD);
  });

  describe("giới hạn đăng nhập sai theo IP", () => {
    const failFive = async () => {
      for (let i = 0; i < 5; i++) expect((await login({ password: "sai" })).status).toBe(401);
    };

    it("5 lần sai vẫn 401, rồi đúng mật khẩu cũng 429 không Set-Cookie và không so mật khẩu", async () => {
      vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
      await failFive();
      vi.mocked(checkAdminPassword).mockClear();
      const response = await login({ password: PASSWORD });
      expect(response.status).toBe(429);
      expect(response.headers.get("set-cookie")).toBeNull();
      expect(checkAdminPassword).not.toHaveBeenCalled();
    });

    it("phản hồi 429 có message hằng số, retryAfterSeconds dạng chuỗi và header Retry-After", async () => {
      vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
      await failFive();
      const response = await login({ password: "sai" });
      const { error } = await response.json();
      expect(error.code).toBe("TOO_MANY_ATTEMPTS");
      expect(error.message).toBe(LOGIN_LOCKED_MESSAGE);
      expect(error.details.retryAfterSeconds).toMatch(/^\d+$/);
      expect(Number(error.details.retryAfterSeconds)).toBeGreaterThanOrEqual(899);
      expect(Number(error.details.retryAfterSeconds)).toBeLessThanOrEqual(900);
      expect(response.headers.get("retry-after")).toBe(error.details.retryAfterSeconds);
    });

    it("10 request sai song song từ một IP: so mật khẩu tối đa 5 lần, còn lại 429", async () => {
      vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
      const responses = await Promise.all(
        Array.from({ length: 10 }, () => login({ password: "sai" })),
      );
      expect(vi.mocked(checkAdminPassword).mock.calls.length).toBeLessThanOrEqual(5);
      expect(responses.filter((r) => r.status === 401)).toHaveLength(5);
      expect(responses.filter((r) => r.status === 429)).toHaveLength(5);
    });

    it("đang khóa thì body sai hình dạng vẫn 429, không phải 400", async () => {
      vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
      await failFive();
      for (const body of ["không phải json", {}]) {
        expect((await login(body)).status).toBe(429);
      }
    });

    it("chỉ lần sai mật khẩu (401) được đếm, 400 và lần đúng thì không", async () => {
      vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
      for (let i = 0; i < 4; i++) await login({ password: "sai" });
      for (let i = 0; i < 6; i++) await login({});
      for (let i = 0; i < 6; i++) expect((await login({ password: PASSWORD })).status).toBe(204);
      expect((await login({ password: "sai" })).status).toBe(401);
      expect((await login({ password: PASSWORD })).status).toBe(429);
    });

    it("IP A bị khóa thì IP B vẫn đăng nhập được", async () => {
      vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
      await failFive();
      const other = await login(
        { password: PASSWORD },
        { headers: { "x-forwarded-for": "9.9.9.9" } },
      );
      expect(other.status).toBe(204);
    });

    it("chưa cấu hình thì 404 trước khi xét khóa", async () => {
      vi.stubEnv("ADMIN_PASSWORD", "");
      expect((await login({ password: "x" })).status).toBe(404);
    });
  });
});
