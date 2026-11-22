// @vitest-environment node
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdminContext } from "@/features/admin/admin-guard";
import { getProductById } from "@/features/catalog/catalog-data";
import { computeCurrentStock } from "@/features/inventory/stock-rules";
import { ORDER_STATUS_CONFLICT_MESSAGE, OrderError } from "./order-errors";
import {
  createInMemoryOrderRepository,
  createJsonFileOrderRepository,
  type OrderRepository,
} from "./order-repository";
import { createOrderService } from "./order-service";
import type { Order, OrderStatus } from "./types";

const staff = {} as AdminContext;
const NOW = new Date("2026-10-22T05:00:00.000Z");
const p010 = getProductById("p010")!;
const withStock = (stock: number) => (id: string) =>
  id === "p010" ? { ...p010, stock } : getProductById(id);

const seeded = (
  id: string,
  status: OrderStatus,
  quantity = 1,
  createdAt = "2026-10-01T00:00:00.000Z",
): Order => ({
  id,
  status,
  createdAt,
  updatedAt: createdAt,
  customer: { fullName: "Khách Cũ", phone: "0900000000", address: "1 A, B, C" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [
    {
      productId: "p010",
      slug: p010.slug,
      name: p010.name,
      image: p010.image,
      unitPrice: p010.price,
      quantity,
      lineTotal: p010.price * quantity,
    },
  ],
  subtotal: 0,
  shippingFee: 0,
  total: 0,
});

const make = (seed: Order[], stock: number, repository?: OrderRepository) => {
  const repo = repository ?? createInMemoryOrderRepository(seed);
  const now = vi.fn(() => NOW);
  return {
    repo,
    now,
    service: createOrderService({ repository: repo, findProduct: withStock(stock), now }),
  };
};

const confirm = { from: "pending", to: "confirmed" } as const;

async function codeOf(promise: Promise<unknown>) {
  const error = await promise.then(
    () => undefined,
    (e: unknown) => e,
  );
  expect(error).toBeInstanceOf(OrderError);
  return error as OrderError;
}

const stockOf = async (repo: OrderRepository, base: number) =>
  computeCurrentStock({ id: "p010", stock: base }, await repo.findAll());

beforeEach(() => {
  vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("transitionByStaff - cặp hợp lệ", () => {
  it("đi pending -> confirmed -> shipping -> delivered; chỉ Xác nhận trừ kho", async () => {
    const { service, repo, now } = make([seeded("SL-A", "pending", 2)], 5);
    expect(await stockOf(repo, 5)).toBe(5);

    const confirmed = await service.transitionByStaff(staff, "SL-A", confirm);
    expect(confirmed).toMatchObject({ status: "confirmed", updatedAt: NOW.toISOString() });
    expect(now).toHaveBeenCalledTimes(1);
    expect(await stockOf(repo, 5)).toBe(3);

    await service.transitionByStaff(staff, "SL-A", { from: "confirmed", to: "shipping" });
    expect(await stockOf(repo, 5)).toBe(3);
    const delivered = await service.transitionByStaff(staff, "SL-A", {
      from: "shipping",
      to: "delivered",
    });
    expect(delivered.status).toBe("delivered");
    expect(await stockOf(repo, 5)).toBe(3);
  });

  it.each<[OrderStatus, OrderStatus]>([
    ["pending", "shipping"],
    ["pending", "delivered"],
    ["confirmed", "pending"],
    ["shipping", "confirmed"],
    ["delivered", "shipping"],
    ["delivered", "cancelled"],
    ["cancelled", "pending"],
    ["cancelled", "confirmed"],
    ["pending", "pending"],
  ])("nhân viên %s -> %s bị 409 INVALID_STATUS_TRANSITION, đơn không đổi", async (from, to) => {
    const { service, repo } = make([seeded("SL-A", from)], 5);
    const input = to === "cancelled" ? { from, to, reason: "out_of_stock" as const } : { from, to };
    const error = await codeOf(service.transitionByStaff(staff, "SL-A", input as never));
    expect(error.code).toBe("INVALID_STATUS_TRANSITION");
    expect(error.httpStatus).toBe(409);
    expect((await repo.findById("SL-A"))?.status).toBe(from);
  });

  it("khách vẫn hủy được đơn pending qua cancelOrder (gọi transitionOrder)", async () => {
    const { service } = make([seeded("SL-A", "pending")], 5);
    const cancelled = await service.cancelOrder("SL-A");
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelledBy).toBe("customer");
    expect(cancelled).not.toHaveProperty("cancelReasonLabel");
  });
});

describe("transitionByStaff - Từ chối đơn (Story 5.1)", () => {
  it.each(["out_of_stock", "customer_cancelled", "unreachable"] as const)(
    "Từ chối pending với lý do %s: cancelledBy staff, tồn không đổi",
    async (reason) => {
      const { service, repo } = make([seeded("SL-A", "pending", 2)], 5);
      const done = await service.transitionByStaff(staff, "SL-A", {
        from: "pending",
        to: "cancelled",
        reason,
      });
      expect(done).toMatchObject({
        status: "cancelled",
        cancelledBy: "staff",
        cancelReason: reason,
        updatedAt: NOW.toISOString(),
      });
      expect(await stockOf(repo, 5)).toBe(5);
    },
  );

  it("service tự kiểm lý do (thiếu hoặc ngoài danh sách): 400 VALIDATION_ERROR, đơn không đổi", async () => {
    const { service, repo } = make([seeded("SL-A", "pending")], 5);
    for (const reason of [undefined, "khac"]) {
      const error = await codeOf(
        service.transitionByStaff(staff, "SL-A", {
          from: "pending",
          to: "cancelled",
          reason,
        } as never),
      );
      expect(error.code).toBe("VALIDATION_ERROR");
      expect(error.details).toHaveProperty("reason");
    }
    expect((await repo.findById("SL-A"))?.status).toBe("pending");
  });

  it("đơn cancelled cũ thiếu cancelledBy vẫn đọc được qua getOrderForStaff", async () => {
    const { service } = make([seeded("SL-OLD", "cancelled")], 5);
    const order = await service.getOrderForStaff(staff, "SL-OLD");
    expect(order.status).toBe("cancelled");
    expect(order.cancelledBy).toBeUndefined();
    expect((await service.getMaskedOrder("SL-OLD")).cancelledBy).toBeUndefined();
  });

  it("Xác nhận và Từ chối đồng thời: đúng một thắng, một bên 409, không có confirmed kèm cancelReason", async () => {
    const { service, repo } = make([seeded("SL-A", "pending")], 5);
    const results = await Promise.allSettled([
      service.transitionByStaff(staff, "SL-A", confirm),
      service.transitionByStaff(staff, "SL-A", {
        from: "pending",
        to: "cancelled",
        reason: "unreachable",
      }),
    ]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect((rejected.reason as OrderError).code).toBe("ORDER_STATUS_CONFLICT");
    const saved = await repo.findById("SL-A");
    expect(saved?.status === "confirmed" && saved.cancelReason).toBeFalsy();
  });

  it("Hai nhân viên cùng Từ chối: một thành công, một 409", async () => {
    const { service } = make([seeded("SL-A", "pending")], 5);
    const reject = { from: "pending", to: "cancelled", reason: "out_of_stock" } as const;
    const results = await Promise.allSettled([
      service.transitionByStaff(staff, "SL-A", reject),
      service.transitionByStaff(staff, "SL-A", reject),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual(["fulfilled", "rejected"]);
  });
});

describe("transitionByStaff - thứ tự kiểm", () => {
  it("1. đơn không tồn tại thắng mọi lỗi khác: 404", async () => {
    const { service } = make([], 0);
    expect((await codeOf(service.transitionByStaff(staff, "SL-X", confirm))).code).toBe(
      "ORDER_NOT_FOUND",
    );
  });

  it("2. from lệch và cặp sai cùng lúc: ORDER_STATUS_CONFLICT với message hằng số", async () => {
    const { service } = make([seeded("SL-A", "confirmed")], 5);
    const error = await codeOf(
      service.transitionByStaff(staff, "SL-A", { from: "pending", to: "delivered" }),
    );
    expect(error.code).toBe("ORDER_STATUS_CONFLICT");
    expect(error.httpStatus).toBe(409);
    expect(error.message).toBe(ORDER_STATUS_CONFLICT_MESSAGE);
    expect(error.message).toBe("Đơn đã được cập nhật ở nơi khác");
  });

  it("3. cặp sai và thiếu hàng cùng lúc: INVALID_STATUS_TRANSITION (from đúng)", async () => {
    // pending -> shipping không hợp lệ dù đơn đòi 99 cái, tồn 1
    const { service } = make([seeded("SL-A", "pending", 99)], 1);
    const error = await codeOf(
      service.transitionByStaff(staff, "SL-A", { from: "pending", to: "shipping" }),
    );
    expect(error.code).toBe("INVALID_STATUS_TRANSITION");
  });

  it("4. cặp hợp lệ, thiếu hàng: INSUFFICIENT_STOCK, đơn giữ pending, tồn không đổi", async () => {
    const { service, repo } = make([seeded("SL-A", "pending", 3)], 2);
    const error = await codeOf(service.transitionByStaff(staff, "SL-A", confirm));
    expect(error.code).toBe("INSUFFICIENT_STOCK");
    expect(error.message).toBe(`Sản phẩm "${p010.name}" chỉ còn 2 sản phẩm`);
    expect((await repo.findById("SL-A"))?.status).toBe("pending");
    expect(await stockOf(repo, 2)).toBe(2);
  });
});

describe("transitionByStaff - kiểm tồn khi Xác nhận", () => {
  it("biên: đặt đúng bằng tồn thì được (tồn về 0), hơn 1 thì bị từ chối", async () => {
    const ok = make([seeded("SL-A", "pending", 2)], 2);
    await ok.service.transitionByStaff(staff, "SL-A", confirm);
    expect(await stockOf(ok.repo, 2)).toBe(0);

    const bad = make([seeded("SL-A", "pending", 3)], 2);
    await codeOf(bad.service.transitionByStaff(staff, "SL-A", confirm));
  });

  it("hết hàng: message 'đã hết hàng'; tồn thô âm vẫn chặn và message dùng n >= 0", async () => {
    const out = make([seeded("SL-C", "confirmed", 2), seeded("SL-A", "pending", 1)], 2);
    expect((await codeOf(out.service.transitionByStaff(staff, "SL-A", confirm))).message).toBe(
      `Sản phẩm "${p010.name}" đã hết hàng`,
    );
    // Tồn gốc bị hạ xuống dưới lượng đã bán: thô = -1
    const negative = make([seeded("SL-C", "confirmed", 2), seeded("SL-A", "pending", 1)], 1);
    expect((await codeOf(negative.service.transitionByStaff(staff, "SL-A", confirm))).message).toBe(
      `Sản phẩm "${p010.name}" đã hết hàng`,
    );
  });

  it("sản phẩm không còn trong catalog có Tồn gốc 0: không Xác nhận được", async () => {
    const order = {
      ...seeded("SL-A", "pending"),
      items: [{ ...seeded("x", "pending").items[0], productId: "p-da-xoa", name: "Món cũ" }],
    };
    const { service } = make([order], 5);
    expect((await codeOf(service.transitionByStaff(staff, "SL-A", confirm))).message).toBe(
      'Sản phẩm "Món cũ" đã hết hàng',
    );
  });
});

describe("transitionByStaff - đồng thời", () => {
  let dir: string;
  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "shoplite-transition-"));
  });
  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  const repos: [string, () => OrderRepository][] = [
    ["in-memory", () => createInMemoryOrderRepository()],
    ["JSON", () => createJsonFileOrderRepository(path.join(dir, "orders.json"))],
  ];

  describe.each(repos)("%s repository", (_name, makeRepo) => {
    it("hai đơn tranh món cuối: đúng một thành công, một INSUFFICIENT_STOCK, tồn không âm", async () => {
      const repo = makeRepo();
      await repo.save(seeded("SL-A", "pending"));
      await repo.save(seeded("SL-B", "pending"));
      const { service } = make([], 1, repo);

      const results = await Promise.allSettled([
        service.transitionByStaff(staff, "SL-A", confirm),
        service.transitionByStaff(staff, "SL-B", confirm),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ code: "INSUFFICIENT_STOCK" });
      expect(await stockOf(repo, 1)).toBe(0);
    });

    it("hai nhân viên Xác nhận cùng một đơn: một thành công, một ORDER_STATUS_CONFLICT", async () => {
      const repo = makeRepo();
      await repo.save(seeded("SL-A", "pending"));
      const { service } = make([], 5, repo);

      const results = await Promise.allSettled([
        service.transitionByStaff(staff, "SL-A", confirm),
        service.transitionByStaff(staff, "SL-A", confirm),
      ]);
      expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
      const rejected = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
      expect(rejected.reason).toMatchObject({ code: "ORDER_STATUS_CONFLICT" });
      expect(await stockOf(repo, 5)).toBe(4);
    });
  });
});

describe("transitionByStaff - đơn tồn đọng", () => {
  it("11 đơn pending cũ (không có trường mới), tồn 10: 10 đơn đầu thành công, đơn thứ 11 bị chặn, kho = 0", async () => {
    const orders = Array.from({ length: 11 }, (_, i) =>
      seeded(
        `SL-OLD-${String(i + 1).padStart(2, "0")}`,
        "pending",
        1,
        `2026-09-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`,
      ),
    );
    const { service, repo } = make(orders, 10);
    const results: string[] = [];
    for (const order of orders) {
      const outcome = await service.transitionByStaff(staff, order.id, confirm).then(
        () => "ok",
        (e: OrderError) => e.code,
      );
      results.push(outcome);
      expect(await stockOf(repo, 10)).toBeGreaterThanOrEqual(0);
    }
    expect(results).toEqual([...Array(10).fill("ok"), "INSUFFICIENT_STOCK"]);
    expect(await stockOf(repo, 10)).toBe(0);
    expect(await service.getOrderForStaff(staff, "SL-OLD-11")).toMatchObject({ status: "pending" });
    expect(await service.listOrders(staff)).toHaveLength(11);
  });
});

describe("statusHistory (Story 5.2)", () => {
  it("đơn cũ chưa có lịch sử: Xác nhận cho [pending(createdAt), confirmed(now)], bền qua JSON", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "shoplite-hist-"));
    try {
      const repo = createJsonFileOrderRepository(path.join(dir, "orders.json"));
      await repo.save(seeded("SL-A", "pending"));
      const { service } = make([], 5, repo);
      await service.transitionByStaff(staff, "SL-A", confirm);
      const saved = await createJsonFileOrderRepository(path.join(dir, "orders.json")).findById(
        "SL-A",
      );
      expect(saved?.statusHistory).toEqual([
        { status: "pending", at: "2026-10-01T00:00:00.000Z" },
        { status: "confirmed", at: NOW.toISOString() },
      ]);
      expect(saved?.updatedAt).toBe(NOW.toISOString());
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("Xác nhận -> Đang giao -> Đã giao tạo đúng 3 mục", async () => {
    const { service } = make([seeded("SL-A", "pending")], 5);
    await service.transitionByStaff(staff, "SL-A", confirm);
    await service.transitionByStaff(staff, "SL-A", { from: "confirmed", to: "shipping" });
    const done = await service.transitionByStaff(staff, "SL-A", {
      from: "shipping",
      to: "delivered",
    });
    expect(done.statusHistory?.map((e) => e.status)).toEqual([
      "pending",
      "confirmed",
      "shipping",
      "delivered",
    ]);
  });

  it("chuyển thất bại không đổi statusHistory và updatedAt", async () => {
    const { service, repo } = make([seeded("SL-A", "pending")], 5);
    await codeOf(service.transitionByStaff(staff, "SL-A", { from: "confirmed", to: "shipping" }));
    await codeOf(service.transitionByStaff(staff, "SL-X", confirm));
    const saved = await repo.findById("SL-A");
    expect(saved?.statusHistory).toBeUndefined();
    expect(saved?.updatedAt).toBe("2026-10-01T00:00:00.000Z");
  });

  it("khách hủy cũng nối lịch sử, at của mục cuối bằng updatedAt", async () => {
    const { service } = make([seeded("SL-A", "pending")], 5);
    const done = await service.cancelOrder("SL-A");
    expect(done.statusHistory?.at(-1)).toEqual({ status: "cancelled", at: done.updatedAt });
  });
});
