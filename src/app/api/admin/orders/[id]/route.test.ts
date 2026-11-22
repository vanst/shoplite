// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionCookie } from "@/features/admin/admin-guard";
import { getProductById } from "@/features/catalog/catalog-data";
import type { Order } from "@/features/orders/types";
import * as routeModule from "./route";
import { PATCH } from "./route";

const mocks = vi.hoisted(() => ({ repository: undefined as unknown }));

vi.mock("@/features/orders/server", async () => {
  const { createOrderService } = await import("@/features/orders/order-service");
  const { createInMemoryOrderRepository } = await import("@/features/orders/order-repository");
  const { getProductById } = await import("@/features/catalog/catalog-data");
  const repository = createInMemoryOrderRepository();
  mocks.repository = repository;
  // Tồn gốc p010 = 1 để hai đơn tranh món cuối
  const findProduct = (id: string) => {
    const product = getProductById(id);
    return product && id === "p010" ? { ...product, stock: 1 } : product;
  };
  return { orderService: createOrderService({ repository, findProduct }) };
});

const p010 = getProductById("p010")!;
const order = (id: string, status: Order["status"] = "pending"): Order => ({
  id,
  status,
  createdAt: "2026-10-21T03:00:00.000Z",
  updatedAt: "2026-10-21T03:00:00.000Z",
  customer: { fullName: "Phạm Minh D", phone: "0356789012", address: "99 Hai Bà Trưng, Huế" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [
    {
      productId: "p010",
      slug: p010.slug,
      name: p010.name,
      image: p010.image,
      unitPrice: p010.price,
      quantity: 1,
      lineTotal: p010.price,
    },
  ],
  subtotal: p010.price,
  shippingFee: 30_000,
  total: p010.price + 30_000,
});

const repo = () => mocks.repository as import("@/features/orders/order-repository").OrderRepository;
const adminCookie = () => createSessionCookie(new Request("http://localhost")).split(";")[0];

const patch = (id: string, payload: unknown, cookie: string | null = adminCookie(), raw?: string) =>
  PATCH(
    new Request(`http://localhost/api/admin/orders/${encodeURIComponent(id)}`, {
      method: "PATCH",
      headers: cookie ? { cookie } : {},
      body: raw ?? (payload === undefined ? undefined : JSON.stringify(payload)),
    }),
    { params: Promise.resolve({ id }) } as never,
  );

const confirm = { from: "pending", to: "confirmed" };

beforeEach(async () => {
  vi.stubEnv("ADMIN_PASSWORD", "mat-khau-test");
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error").mockImplementation(() => {});
  // Làm sạch repository dùng chung giữa các test
  for (const existing of await repo().findAll()) {
    await repo().save({ ...existing, status: "cancelled", items: [], stockAdjustment: undefined });
  }
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("PATCH /api/admin/orders/:id - quyền", () => {
  it("chưa đặt ADMIN_PASSWORD: 404 thân rỗng", async () => {
    vi.stubEnv("ADMIN_PASSWORD", "");
    const response = await patch("SL-A", confirm, null);
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });

  it("chưa đăng nhập: 401 UNAUTHORIZED theo envelope", async () => {
    const response = await patch("SL-A", confirm, null);
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHORIZED");
  });

  it("cookie sai (purpose khác/giả): 401", async () => {
    const response = await patch("SL-A", confirm, "shoplite_admin=gia.mao");
    expect(response.status).toBe(401);
  });

  it("cổng quyền chạy trước readJsonBody: body hỏng và chưa đăng nhập vẫn 401", async () => {
    const response = await patch("SL-A", undefined, null, "{khong-phai-json");
    expect(response.status).toBe(401);
  });

  it("không đổi trạng thái đơn khi bị từ chối", async () => {
    await repo().save(order("SL-A"));
    await patch("SL-A", confirm, null);
    expect((await repo().findById("SL-A"))?.status).toBe("pending");
  });
});

describe("PATCH /api/admin/orders/:id - body", () => {
  it("đã đăng nhập, body không phải JSON: 400 'Body phải là JSON hợp lệ'", async () => {
    const response = await patch("SL-A", undefined, adminCookie(), "{khong-phai-json");
    expect(response.status).toBe(400);
    expect(await response.json()).toMatchObject({
      error: { code: "VALIDATION_ERROR", message: "Body phải là JSON hợp lệ" },
    });
  });

  it("sai hình dạng: 400 VALIDATION_ERROR kèm details theo trường", async () => {
    const response = await patch("SL-A", { from: "pending", to: "rejected" });
    expect(response.status).toBe(400);
    const { error } = await response.json();
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.details).toHaveProperty("to");
  });

  it("mã đơn dài hơn 32 ký tự: 400; đúng 32 ký tự: qua cổng mã và 404 vì không tồn tại", async () => {
    expect((await patch("A".repeat(33), confirm)).status).toBe(400);
    expect((await patch("A".repeat(32), confirm)).status).toBe(404);
  });
});

describe("PATCH /api/admin/orders/:id - nghiệp vụ", () => {
  it("Xác nhận đơn pending đủ hàng: 200 với Order đầy đủ; bỏ qua total/unitPrice/stock gửi kèm", async () => {
    await repo().save(order("SL-A"));
    const response = await patch("SL-A", { ...confirm, total: 1, unitPrice: 1, stock: 999 });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ id: "SL-A", status: "confirmed", total: p010.price + 30_000 });
    expect(body.customer.phone).toBe("0356789012");
    expect(body.items[0].unitPrice).toBe(p010.price);
  });

  it("mã đơn viết thường hoặc có khoảng trắng vẫn khớp", async () => {
    await repo().save(order("SL-A"));
    expect((await patch(" sl-a ", confirm)).status).toBe(200);
  });

  it("Báo thiếu hàng: 200 ghi stockAdjustment; thiếu productId hoặc productId lạ: 400, đơn giữ confirmed", async () => {
    await repo().save(order("SL-A", "confirmed"));
    const body = { from: "confirmed", to: "cancelled", reason: "out_of_stock" };
    expect((await patch("SL-A", body)).status).toBe(400);
    expect((await patch("SL-A", { ...body, productId: "p999" })).status).toBe(400);
    expect((await repo().findById("SL-A"))?.status).toBe("confirmed");
    const ok = await patch("SL-A", { ...body, productId: "p010" });
    expect(ok.status).toBe(200);
    expect(await ok.json()).toMatchObject({
      status: "cancelled",
      cancelReason: "out_of_stock",
      stockAdjustment: { productId: "p010", quantity: 1 },
    });
  });

  it("lỗi nghiệp vụ đúng status + body { error: { code, message } }", async () => {
    await repo().save(order("SL-A"));
    const notFound = await patch("SL-KHONG-CO", confirm);
    expect(notFound.status).toBe(404);
    expect((await notFound.json()).error.code).toBe("ORDER_NOT_FOUND");

    const conflict = await patch("SL-A", { from: "confirmed", to: "shipping" });
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({
      error: { code: "ORDER_STATUS_CONFLICT", message: "Đơn đã được cập nhật ở nơi khác" },
    });

    const invalid = await patch("SL-A", { from: "pending", to: "shipping" });
    expect(invalid.status).toBe(409);
    expect((await invalid.json()).error.code).toBe("INVALID_STATUS_TRANSITION");

    await repo().save(order("SL-C", "confirmed")); // đã giữ món cuối
    await repo().save(order("SL-B"));
    const short = await patch("SL-B", confirm);
    expect(short.status).toBe(409);
    const { error } = await short.json();
    expect(error.code).toBe("INSUFFICIENT_STOCK");
    expect(Object.keys(error).sort()).toEqual(["code", "message"]);
  });

  it("lỗi không xác định: 500 INTERNAL_ERROR, không lộ chi tiết", async () => {
    await repo().save(order("SL-A"));
    const spy = vi.spyOn(repo(), "transaction").mockRejectedValue(new Error("0356789012 boom"));
    const response = await patch("SL-A", confirm);
    spy.mockRestore();
    expect(response.status).toBe(500);
    expect((await response.json()).error.code).toBe("INTERNAL_ERROR");
  });

  it("hai PATCH xác nhận hai đơn tranh món cuối: một 200, một 409 INSUFFICIENT_STOCK", async () => {
    await repo().save(order("SL-A"));
    await repo().save(order("SL-B"));
    const responses = await Promise.all([patch("SL-A", confirm), patch("SL-B", confirm)]);
    expect(responses.map((r) => r.status).sort()).toEqual([200, 409]);
    const failed = responses.find((r) => r.status === 409)!;
    expect((await failed.json()).error.code).toBe("INSUFFICIENT_STOCK");
  });

  it("route chỉ export PATCH (GET/POST do Next trả 405), không Server Action", () => {
    expect(Object.keys(routeModule)).toEqual(["PATCH"]);
  });
});
