// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionCookie } from "@/features/admin/admin-guard";
import { GET, POST } from "./route";

// Thay orderService (ghi file) bằng bản dùng repository trong bộ nhớ.
vi.mock("@/features/orders/server", async () => {
  const { createOrderService } = await import("@/features/orders/order-service");
  const { createInMemoryOrderRepository } = await import("@/features/orders/order-repository");
  return { orderService: createOrderService({ repository: createInMemoryOrderRepository() }) };
});

const PASSWORD = "mat-khau-test";
const adminCookie = () => createSessionCookie(new Request("http://localhost")).split(";")[0];
const getOrders = (cookie?: string) =>
  GET(new Request("http://localhost/api/orders", { headers: cookie ? { cookie } : {} }));
const GET_ADMIN = async () => getOrders(adminCookie());

const postOrder = (body: unknown, cookie?: string) =>
  POST(
    new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const validBody = {
  customer: { fullName: "Phạm Minh D", phone: "0356789012", address: "99 Hai Bà Trưng, Huế" },
  shippingMethod: "express",
  paymentMethod: "bank_transfer",
  items: [{ productId: "p006", quantity: 1 }],
};

beforeEach(() => {
  vi.stubEnv("ADMIN_PASSWORD", PASSWORD);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("POST /api/orders", () => {
  it("201 - tạo đơn hàng thành công, trả MaskedOrder và cookie grant placed", async () => {
    const response = await postOrder(validBody);
    expect(response.status).toBe(201);
    const order = await response.json();
    expect(order).toMatchObject({ status: "pending", subtotal: 450_000, shippingFee: 60_000 });
    expect(order).not.toHaveProperty("customer");
    expect(order.recipient).toMatchObject({ name: "D", phone: "•••••• 9012", area: "Huế" });
    expect(JSON.stringify(order)).not.toContain("0356789012");
    expect(response.headers.get("set-cookie")).toMatch(/^shoplite_grants=.*HttpOnly/);
  });

  it("đặt đơn thứ hai giữ grant của đơn đầu", async () => {
    const first = await postOrder(validBody);
    const firstId = (await first.json()).id;
    const cookie = first.headers.get("set-cookie")!.split(";")[0];
    const second = await postOrder(validBody, cookie);
    const secondId = (await second.json()).id;
    const merged = second.headers.get("set-cookie")!.split(";")[0];
    const { hasGrant } = await import("@/features/order-access/order-grant");
    const token = merged.split("=")[1];
    expect(hasGrant(token, firstId)).toBe(true);
    expect(hasGrant(token, secondId)).toBe(true);
  });

  it("lỗi 400, 409 không kèm Set-Cookie", async () => {
    const bad = await postOrder("{oops");
    const stock = await postOrder({ ...validBody, items: [{ productId: "p004", quantity: 1 }] });
    expect(bad.headers.get("set-cookie")).toBeNull();
    expect(stock.headers.get("set-cookie")).toBeNull();
  });

  it("400 - body không phải JSON", async () => {
    const response = await postOrder("{oops");
    expect(response.status).toBe(400);
    expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
  });

  it("400 - dữ liệu không hợp lệ kèm details", async () => {
    const response = await postOrder({
      ...validBody,
      customer: { ...validBody.customer, phone: "1" },
    });
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error.details).toHaveProperty(["customer.phone"]);
  });

  it("409 - vượt quá tồn kho", async () => {
    const response = await postOrder({ ...validBody, items: [{ productId: "p004", quantity: 1 }] });
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("INSUFFICIENT_STOCK");
  });
});

describe("GET /api/orders", () => {
  it("404 thân rỗng khi chưa đặt ADMIN_PASSWORD", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    const response = await getOrders();
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("401 không kèm dữ liệu đơn khi chưa đăng nhập", async () => {
    await postOrder(validBody);
    const response = await getOrders();
    expect(response.status).toBe(401);
    const text = await response.text();
    expect(JSON.parse(text).error.code).toBe("UNAUTHORIZED");
    expect(text).not.toContain("Phạm Minh D");
  });

  it("200 danh sách đầy đủ, mới nhất trước, khi có phiên quản trị", async () => {
    await postOrder(validBody);
    const response = await GET_ADMIN();
    const { orders } = await response.json();
    expect(response.status).toBe(200);
    expect(orders.length).toBeGreaterThan(0);
    expect(orders[0].customer.phone).toBe("0356789012");
    const times = orders.map((o: { createdAt: string }) => o.createdAt);
    expect(times).toEqual([...times].sort().reverse());
  });
});

describe("POST /api/orders - mã giảm giá", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-08T10:00:00+07:00"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("422 - mã hết hạn, đúng định dạng lỗi và không tạo đơn mới", async () => {
    const before = (await (await GET_ADMIN()).json()).orders.length;

    const response = await postOrder({ ...validBody, couponCode: "TET2026" });

    expect(response.status).toBe(422);
    expect(await response.json()).toEqual({
      error: {
        code: "COUPON_EXPIRED",
        message: "Mã giảm giá đã hết hạn",
        details: { couponCode: "Mã giảm giá đã hết hạn" },
      },
    });
    expect((await (await GET_ADMIN()).json()).orders.length).toBe(before);
  });

  it("201 - bỏ qua số tiền giảm client gửi lên", async () => {
    // p006 450.000đ → SHOPLITE10 giảm 45.000đ, giao nhanh 60.000đ
    const response = await postOrder({ ...validBody, couponCode: "shoplite10", discount: 999_999 });

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({
      couponCode: "SHOPLITE10",
      subtotal: 450_000,
      discount: 45_000,
      shippingFee: 60_000,
      total: 465_000,
    });
  });
});
