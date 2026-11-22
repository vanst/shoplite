// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionCookie } from "@/features/admin/admin-guard";
import { POST as postOrderRoute } from "../route";
import { GET, PATCH } from "./route";

vi.mock("@/features/orders/server", async () => {
  const { createOrderService } = await import("@/features/orders/order-service");
  const { createInMemoryOrderRepository } = await import("@/features/orders/order-repository");
  return { orderService: createOrderService({ repository: createInMemoryOrderRepository() }) };
});

const body = {
  customer: { fullName: "Phạm Minh D", phone: "0356789012", address: "99 Hai Bà Trưng, Huế" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [{ productId: "p010", quantity: 1 }],
};

async function placeOrder() {
  const response = await postOrderRoute(
    new Request("http://localhost/api/orders", { method: "POST", body: JSON.stringify(body) }),
  );
  return {
    id: (await response.json()).id as string,
    cookie: response.headers.get("set-cookie")!.split(";")[0],
  };
}

const params = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const call = (
  fn: typeof GET | typeof PATCH,
  id: string,
  { cookie, payload }: { cookie?: string; payload?: unknown } = {},
) =>
  fn(
    new Request(`http://localhost/api/orders/${id}`, {
      method: fn === GET ? "GET" : "PATCH",
      headers: cookie ? { cookie } : {},
      body: payload === undefined ? undefined : JSON.stringify(payload),
    }),
    params(id),
  );

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", "mat-khau-test");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("GET /api/orders/:id", () => {
  it("phiên quản trị nhận Order đầy đủ; id không tồn tại thì 404 ORDER_NOT_FOUND", async () => {
    const { id } = await placeOrder();
    const admin = createSessionCookie(new Request("http://localhost")).split(";")[0];
    const ok = await call(GET, id, { cookie: admin });
    expect(ok.status).toBe(200);
    expect((await ok.json()).customer.phone).toBe("0356789012");
    expect((await call(GET, "SL-KHONG-CO", { cookie: admin })).status).toBe(404);
  });

  it("grant đúng id nhận MaskedOrder, kể cả id viết thường", async () => {
    const { id, cookie } = await placeOrder();
    const response = await call(GET, id.toLowerCase(), { cookie });
    expect(response.status).toBe(200);
    const masked = await response.json();
    expect(masked).not.toHaveProperty("customer");
    expect(JSON.stringify(masked)).not.toContain("0356789012");
  });

  it("không quyền: id tồn tại, không tồn tại, quá dài và grant đơn khác đều cùng 401 một body", async () => {
    const a = await placeOrder();
    const b = await placeOrder();
    const responses = await Promise.all([
      call(GET, a.id),
      call(GET, "SL-KHONG-CO"),
      call(GET, "A".repeat(40)),
      call(GET, a.id, { cookie: b.cookie }),
    ]);
    const texts = await Promise.all(responses.map((r) => r.text()));
    expect(responses.map((r) => r.status)).toEqual([401, 401, 401, 401]);
    expect(new Set(texts).size).toBe(1);
    expect(JSON.parse(texts[0]).error.code).toBe("UNAUTHORIZED");
  });
});

describe("PATCH /api/orders/:id", () => {
  it("401 trước khi đọc body khi không có grant đúng id; phiên quản trị không đủ", async () => {
    const { id } = await placeOrder();
    const admin = createSessionCookie(new Request("http://localhost")).split(";")[0];
    expect((await call(PATCH, id, { payload: { status: "cancelled" } })).status).toBe(401);
    expect(
      (await call(PATCH, id, { cookie: admin, payload: { status: "cancelled" } })).status,
    ).toBe(401);
    const still = await call(GET, id, { cookie: admin });
    expect((await still.json()).status).toBe("pending");
  });

  it("400 khi có quyền nhưng body khác { status: cancelled }", async () => {
    const { id, cookie } = await placeOrder();
    for (const payload of [{ status: "confirmed" }, {}, "x"]) {
      const response = await call(PATCH, id, { cookie, payload });
      expect(response.status).toBe(400);
    }
  });

  it("hủy đơn pending: MaskedOrder đã hủy; hủy lần hai 409 với message hiện có", async () => {
    const { id, cookie } = await placeOrder();
    const first = await call(PATCH, id, { cookie, payload: { status: "cancelled" } });
    expect(first.status).toBe(200);
    const masked = await first.json();
    expect(masked).toMatchObject({ status: "cancelled" });
    expect(masked).not.toHaveProperty("customer");
    const second = await call(PATCH, id, { cookie, payload: { status: "cancelled" } });
    expect(second.status).toBe(409);
    expect((await second.json()).error).toMatchObject({
      code: "INVALID_STATUS_TRANSITION",
      message: "Chỉ có thể hủy đơn hàng đang ở trạng thái Chờ xác nhận",
    });
  });
});
