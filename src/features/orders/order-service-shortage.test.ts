// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminContext } from "@/features/admin/admin-guard";
import { getProductById } from "@/features/catalog/catalog-data";
import { computeCurrentStock } from "@/features/inventory/stock-rules";
import { OrderError } from "./order-errors";
import {
  createInMemoryOrderRepository,
  createJsonFileOrderRepository,
  type OrderRepository,
} from "./order-repository";
import { createOrderService } from "./order-service";
import type { Order, OrderStatus } from "./types";

const staff = {} as AdminContext;
const NOW = new Date("2026-10-22T05:00:00.000Z");
const A = getProductById("p010")!;
const B = getProductById("p001")!;
const findProduct = (id: string) =>
  id === "p010" ? { ...A, stock: 5 } : id === "p001" ? { ...B, stock: 5 } : undefined;

const line = (p: typeof A, quantity: number) => ({
  productId: p.id,
  slug: p.slug,
  name: p.name,
  image: p.image,
  unitPrice: p.price,
  quantity,
  lineTotal: p.price * quantity,
});

const seeded = (id: string, status: OrderStatus): Order => ({
  id,
  status,
  createdAt: "2026-10-01T00:00:00.000Z",
  updatedAt: "2026-10-01T00:00:00.000Z",
  customer: { fullName: "Khách", phone: "0900000000", address: "1 A, B, C" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [line(A, 2), line(B, 1)],
  subtotal: 0,
  shippingFee: 0,
  total: 0,
});

const shortage = (productId: string) =>
  ({ from: "confirmed", to: "cancelled", reason: "out_of_stock", productId }) as const;

const stock = async (repo: OrderRepository, id: string, base: number) =>
  computeCurrentStock({ id, stock: base }, await repo.findAll());

let dir: string;
beforeEach(async () => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
  dir = await mkdtemp(path.join(tmpdir(), "shoplite-shortage-"));
});
afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(OrderError);
  return error as OrderError;
}

describe("transitionByStaff - Báo thiếu hàng (Story 5.7)", () => {
  it("hủy, ghi statusHistory và Điều chỉnh tồn một lần commit; A giữ trừ, B trả lại", async () => {
    const repo = createInMemoryOrderRepository([seeded("SL-A", "confirmed")]);
    const service = createOrderService({ repository: repo, findProduct, now: () => NOW });
    expect(await stock(repo, "p010", 5)).toBe(3);
    expect(await stock(repo, "p001", 5)).toBe(4);

    const done = await service.transitionByStaff(staff, "SL-A", shortage("p010"));
    expect(done).toMatchObject({
      status: "cancelled",
      cancelledBy: "staff",
      cancelReason: "out_of_stock",
      stockAdjustment: { productId: "p010", quantity: 2 },
      updatedAt: NOW.toISOString(),
    });
    expect(done.statusHistory?.at(-1)).toEqual({ status: "cancelled", at: NOW.toISOString() });
    expect(await stock(repo, "p010", 5)).toBe(3);
    expect(await stock(repo, "p001", 5)).toBe(5);
  });

  it("productId không thuộc đơn: 400 VALIDATION_ERROR, đơn không đổi", async () => {
    const repo = createInMemoryOrderRepository([seeded("SL-A", "confirmed")]);
    const service = createOrderService({ repository: repo, findProduct, now: () => NOW });
    const error = await codeOf(service.transitionByStaff(staff, "SL-A", shortage("p999")));
    expect(error.code).toBe("VALIDATION_ERROR");
    expect(error.httpStatus).toBe(400);
    expect((await repo.findById("SL-A"))?.status).toBe("confirmed");
  });

  it("service tự kiểm: thiếu productId hoặc lý do khác out_of_stock thì 400", async () => {
    const repo = createInMemoryOrderRepository([seeded("SL-A", "confirmed")]);
    const service = createOrderService({ repository: repo, findProduct, now: () => NOW });
    for (const input of [
      { from: "confirmed", to: "cancelled", reason: "out_of_stock" },
      { from: "confirmed", to: "cancelled", reason: "unreachable", productId: "p010" },
    ]) {
      const error = await codeOf(service.transitionByStaff(staff, "SL-A", input as never));
      expect(error.code).toBe("VALIDATION_ERROR");
    }
    expect((await repo.findById("SL-A"))?.status).toBe("confirmed");
  });

  it.each(["shipping", "delivered", "cancelled", "pending"] as const)(
    "đơn %s: from=confirmed lệch thì ORDER_STATUS_CONFLICT",
    async (status) => {
      const repo = createInMemoryOrderRepository([seeded("SL-A", status)]);
      const service = createOrderService({ repository: repo, findProduct, now: () => NOW });
      const error = await codeOf(service.transitionByStaff(staff, "SL-A", shortage("p010")));
      expect(error.code).toBe("ORDER_STATUS_CONFLICT");
    },
  );

  it("bền qua khởi động lại: JSON repository mới vẫn trừ đúng, đơn cũ thiếu trường vẫn đọc được", async () => {
    const file = path.join(dir, "orders.json");
    const repo = createJsonFileOrderRepository(file);
    await repo.save(seeded("SL-A", "confirmed"));
    await repo.save(seeded("SL-OLD", "cancelled")); // đơn cũ: không cancelledBy/stockAdjustment
    const service = createOrderService({ repository: repo, findProduct, now: () => NOW });
    await service.transitionByStaff(staff, "SL-A", shortage("p010"));

    const reopened = createJsonFileOrderRepository(file);
    expect((await reopened.findById("SL-A"))?.stockAdjustment).toEqual({
      productId: "p010",
      quantity: 2,
    });
    expect(await stock(reopened, "p010", 5)).toBe(3);
    expect(await stock(reopened, "p001", 5)).toBe(5);
    expect((await reopened.findById("SL-OLD"))?.stockAdjustment).toBeUndefined();
  });

  it("hai nhân viên cùng Báo thiếu hàng một đơn: một thành công, một ORDER_STATUS_CONFLICT", async () => {
    const repo = createJsonFileOrderRepository(path.join(dir, "orders.json"));
    await repo.save(seeded("SL-A", "confirmed"));
    const service = createOrderService({ repository: repo, findProduct, now: () => NOW });
    const results = await Promise.allSettled([
      service.transitionByStaff(staff, "SL-A", shortage("p010")),
      service.transitionByStaff(staff, "SL-A", shortage("p001")),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toMatchObject({ code: "ORDER_STATUS_CONFLICT" });
    expect((await repo.findById("SL-A"))?.stockAdjustment).toBeDefined();
  });
});
