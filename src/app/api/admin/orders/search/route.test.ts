// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionCookie } from "@/features/admin/admin-guard";
import * as routeModule from "./route";
import { POST } from "./route";

const mocks = vi.hoisted(() => ({ repository: undefined as unknown }));

vi.mock("@/features/orders/server", async () => {
  const { createOrderService } = await import("@/features/orders/order-service");
  const { createInMemoryOrderRepository } = await import("@/features/orders/order-repository");
  const repository = createInMemoryOrderRepository();
  mocks.repository = repository;
  return { orderService: createOrderService({ repository }) };
});

const repo = () => mocks.repository as import("@/features/orders/order-repository").OrderRepository;
const adminCookie = () => createSessionCookie(new Request("http://localhost")).split(";")[0];

const post = (payload: unknown, cookie: string | null = adminCookie(), raw?: string) =>
  POST(
    new Request("http://localhost/api/admin/orders/search", {
      method: "POST",
      headers: cookie ? { cookie } : {},
      body: raw ?? JSON.stringify(payload),
    }),
  );

beforeEach(async () => {
  vi.stubEnv("ADMIN_PASSWORD", "mat-khau-test");
  vi.spyOn(console, "error").mockImplementation(() => {});
  await repo().save({
    id: "SL-S1",
    status: "pending",
    createdAt: "2026-10-21T03:00:00.000Z",
    updatedAt: "2026-10-21T03:00:00.000Z",
    customer: { fullName: "Lan", phone: "+84912345678", address: "99 Hai Bà Trưng, Huế" },
    shippingMethod: "standard",
    paymentMethod: "cod",
    items: [],
    subtotal: 0,
    shippingFee: 0,
    total: 0,
  });
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/admin/orders/search", () => {
  it("chưa cấu hình: 404 thân rỗng; chưa đăng nhập: 401 (trước cả body hỏng)", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    const off = await post({ phone: "0912345678" }, null);
    expect(off.status).toBe(404);
    expect(await off.text()).toBe("");
    vi.stubEnv("ADMIN_PASSWORD", "mat-khau-test");
    expect((await post(undefined, null, "{hong")).status).toBe(401);
  });

  it("body không phải JSON hoặc sai schema: 400 VALIDATION_ERROR", async () => {
    expect((await post(undefined, adminCookie(), "{hong")).status).toBe(400);
    for (const bad of [{}, { phone: 1 }, { phone: "0".repeat(33) }]) {
      const res = await post(bad);
      expect(res.status).toBe(400);
      expect((await res.json()).error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("thành công: 200 { rows } no-store, khớp dạng 0… với đơn lưu +84…, không PII", async () => {
    const res = await post({ phone: " 0912 345 678 " });
    expect(res.status).toBe(200);
    expect(res.headers.get("Cache-Control")).toBe("no-store");
    const text = await res.text();
    expect(JSON.parse(text).rows.map((r: { id: string }) => r.id)).toEqual(["SL-S1"]);
    expect(text).not.toContain("912345678");
  });

  it("SĐT sai định dạng: 200 rows rỗng", async () => {
    const res = await post({ phone: "123" });
    expect(res.status).toBe(200);
    expect((await res.json()).rows).toEqual([]);
  });

  it("không có handler GET (405)", () => {
    expect("GET" in routeModule).toBe(false);
  });
});
