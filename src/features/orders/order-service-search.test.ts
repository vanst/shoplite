// @vitest-environment node
import { describe, expect, it } from "vitest";
import type { AdminContext } from "@/features/admin/admin-guard";
import { createInMemoryOrderRepository } from "./order-repository";
import { createOrderService } from "./order-service";
import type { Order, OrderStatus } from "./types";

const staff = {} as AdminContext;
const NOW = new Date("2026-10-22T05:00:00.000Z");

const seeded = (id: string, phone: string, createdAt: string, status: OrderStatus = "pending") =>
  ({
    id,
    status,
    createdAt,
    updatedAt: createdAt,
    customer: { fullName: "Khách Hotline", phone, address: "1 A, B, C" },
    shippingMethod: "standard",
    paymentMethod: "cod",
    items: [
      {
        productId: "p010",
        slug: "s",
        name: "n",
        image: "i",
        unitPrice: 1,
        quantity: 2,
        lineTotal: 2,
      },
    ],
    subtotal: 2,
    shippingFee: 0,
    total: 2,
    ...(status === "cancelled" && { cancelledBy: "customer" as const }),
  }) as unknown as Order;

async function setup() {
  const repository = createInMemoryOrderRepository();
  await repository.save(seeded("SL-1", "0912345678", "2026-10-01T00:00:00.000Z"));
  await repository.save(seeded("SL-2", "+84912345678", "2026-10-02T00:00:00.000Z", "cancelled"));
  await repository.save(seeded("SL-3", "0912 345 678", "2026-10-03T00:00:00.000Z", "delivered"));
  await repository.save(seeded("SL-4", "0912345679", "2026-10-04T00:00:00.000Z"));
  return createOrderService({ repository, now: () => NOW });
}

describe("orderService.searchByPhone", () => {
  it("khớp mọi dạng lưu 0… / +84… / có khoảng trắng, mọi trạng thái, mới nhất trước", async () => {
    const rows = await (await setup()).searchByPhone(staff, "0912345678");
    expect(rows.map((r) => r.id)).toEqual(["SL-3", "SL-2", "SL-1"]);
    expect(rows[1].cancelLabel).toBe("Khách tự hủy");
  });

  it("nhập dạng +84 hoặc có dấu cách cũng khớp", async () => {
    const service = await setup();
    expect(await service.searchByPhone(staff, "+84 912-345-678")).toHaveLength(3);
  });

  it("không khớp số khác, thiếu hay thừa chữ số", async () => {
    const service = await setup();
    expect(await service.searchByPhone(staff, "0912345670")).toEqual([]);
    expect(await service.searchByPhone(staff, "091234567")).toEqual([]);
    expect(await service.searchByPhone(staff, "09123456789")).toEqual([]);
  });

  it("số không hợp lệ trả rỗng, không lỗi", async () => {
    const service = await setup();
    expect(await service.searchByPhone(staff, "123")).toEqual([]);
    expect(await service.searchByPhone(staff, "abcdefghij")).toEqual([]);
  });

  it("QueueRow không chứa SĐT, email hay địa chỉ", async () => {
    const rows = await (await setup()).searchByPhone(staff, "0912345678");
    const json = JSON.stringify(rows);
    expect(json).not.toContain("912345678");
    expect(json).not.toContain("1 A, B, C");
  });

  it("quét 36.000 đơn dưới 200 ms", async () => {
    const seed = Array.from({ length: 36_000 }, (_, i) =>
      seeded(`SL-${i}`, `09${String(i).padStart(8, "0")}`, "2026-10-01T00:00:00.000Z"),
    );
    const repository = createInMemoryOrderRepository(seed);
    const service = createOrderService({ repository, now: () => NOW });
    const start = performance.now();
    const rows = await service.searchByPhone(staff, "0900000007");
    expect(performance.now() - start).toBeLessThan(200);
    expect(rows).toHaveLength(1);
  });
});
