// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createInMemoryOrderRepository } from "@/features/orders/order-repository";
import { createOrderService } from "@/features/orders/order-service";
import { POST } from "./route";

const repository = createInMemoryOrderRepository();
const service = createOrderService({ repository });

vi.mock("@/features/orders/server", () => ({
  get orderService() {
    return service;
  },
}));

const place = (phone: string) =>
  service.placeOrder({
    customer: { fullName: "Nguyễn Thị Mai", phone, address: "12 Lê Lợi, Quận 1, TP.HCM" },
    shippingMethod: "standard",
    paymentMethod: "cod",
    items: [{ productId: "p010", quantity: 1 }],
  });

let ipCounter = 0;
let ip = "";
beforeEach(() => {
  ip = `10.0.0.${++ipCounter}`; // mỗi test một IP để không dính khóa của test khác
});

const lookup = (body: unknown, headers: Record<string, string> = {}) =>
  POST(
    new Request("http://localhost/api/orders/lookup", {
      method: "POST",
      headers: { "x-forwarded-for": ip, ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

describe("POST /api/orders/lookup", () => {
  it("200 MaskedOrder + cookie grant lookup khi đúng 4 số cuối (0… và +84…)", async () => {
    const a = await place("0912345678");
    const b = await place("+84987654321");
    for (const [order, verification] of [
      [a, "5678"],
      [b, "4321"],
    ] as const) {
      const response = await lookup({ orderId: ` ${order.id.toLowerCase()} `, verification });
      expect(response.status).toBe(200);
      const body = await response.json();
      expect(body.id).toBe(order.id);
      expect(body).not.toHaveProperty("customer");
      expect(JSON.stringify(body)).not.toContain("0912345678");
      expect(response.headers.get("set-cookie")).toMatch(/^shoplite_grants=.*HttpOnly/);
    }
  });

  it("400 khi body sai hình dạng, JSON hỏng hoặc mã đơn quá dài", async () => {
    for (const body of [
      {},
      { orderId: "SL-1" },
      { orderId: "SL-1", verification: "123" },
      { orderId: "SL-1", verification: "12345" },
      "{oops",
      { orderId: "A".repeat(33), verification: "1234" },
    ]) {
      const response = await lookup(body);
      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("404 cùng một body cho đơn không tồn tại và sai Mã xác minh", async () => {
    const order = await place("0912345678");
    const wrong = await lookup({ orderId: order.id, verification: "0000" });
    const missing = await lookup({ orderId: "SL-KHONG-CO", verification: "0000" });
    expect(wrong.status).toBe(404);
    expect(missing.status).toBe(404);
    const text = await wrong.text();
    expect(text).toBe(await missing.text());
    expect(JSON.parse(text).error).toMatchObject({
      code: "ORDER_NOT_FOUND",
      message: "Không tìm thấy đơn hoặc thông tin xác minh không đúng",
    });
    expect(wrong.headers.get("set-cookie")).toBeNull();
  });

  it("429 sau 5 lần sai theo client, kể cả đúng Mã xác minh; kèm Retry-After", async () => {
    const order = await place("0912345678");
    for (let i = 0; i < 5; i++) {
      expect((await lookup({ orderId: `SL-X${i}`, verification: "0000" })).status).toBe(404);
    }
    const response = await lookup({ orderId: order.id, verification: "5678" });
    expect(response.status).toBe(429);
    expect(response.headers.get("retry-after")).toBe("900");
    const { error } = await response.json();
    expect(error.code).toBe("TOO_MANY_ATTEMPTS");
    expect(error.message).toBe("Bạn thử sai quá nhiều lần, vui lòng thử lại sau");
    expect(error.details.retryAfterSeconds).toBe("900");
  });

  it("429 theo mã đơn khi nhiều client cùng đoán một đơn", async () => {
    const order = await place("0912345678");
    for (let i = 0; i < 5; i++) {
      ip = `10.1.0.${++ipCounter}`;
      expect((await lookup({ orderId: order.id, verification: "0000" })).status).toBe(404);
    }
    ip = `10.1.0.${++ipCounter}`;
    expect((await lookup({ orderId: order.id, verification: "5678" })).status).toBe(429);
  });

  it("chỉ lần sai được đếm: lần đúng và lần 400 không dẫn tới khóa", async () => {
    const order = await place("0912345678");
    for (let i = 0; i < 8; i++) {
      expect((await lookup({ orderId: order.id, verification: "5678" })).status).toBe(200);
      expect((await lookup({ orderId: order.id, verification: "12" })).status).toBe(400);
    }
  });

  it("client đang bị khóa thì body hỏng cũng trả 429 (khóa kiểm trước readJsonBody)", async () => {
    for (let i = 0; i < 5; i++) await lookup({ orderId: `SL-Y${i}`, verification: "0000" });
    expect((await lookup("{oops")).status).toBe(429);
  });
});
