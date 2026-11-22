// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ notFound: vi.fn(), redirect: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));

import { createSessionCookie } from "@/features/admin/admin-guard";
import { POST as login } from "../login/route";
import * as route from "./route";

const url = "http://localhost/api/admin/logout";
const post = (headers?: Record<string, string>) =>
  route.POST(new Request(url, { method: "POST", headers }));

afterEach(() => vi.unstubAllEnvs());

describe("POST /api/admin/logout", () => {
  it("có phiên thì 204 và xóa cookie", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    const token = createSessionCookie(new Request(url)).split(";")[0];
    const response = await post({ cookie: token });
    expect(response.status).toBe(204);
    const cleared = response.headers.get("set-cookie") ?? "";
    expect(cleared).toContain("shoplite_admin=;");
    expect(cleared).toContain("Max-Age=0");
  });

  it("nhận cookie do route đăng nhập trả về", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    const loggedIn = await login(
      new Request("http://localhost/api/admin/login", {
        method: "POST",
        body: JSON.stringify({ password: "abc" }),
      }),
    );
    const cookie = (loggedIn.headers.get("set-cookie") ?? "").split(";")[0];
    expect((await post({ cookie })).status).toBe(204);
  });

  it("không có phiên thì 401 UNAUTHORIZED", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "abc");
    const response = await post();
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("chưa cấu hình thì 404 thân rỗng", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    const response = await post();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("chỉ export POST, không có GET", () => {
    expect(Object.keys(route).sort()).toEqual(["POST"]);
  });
});
