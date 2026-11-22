// @vitest-environment node
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import fs from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createInMemoryOrderRepository,
  createJsonFileOrderRepository,
  type OrderRepository,
} from "./order-repository";
import type { Order } from "./types";

const sampleOrder = (id: string): Order => ({
  id,
  status: "pending",
  createdAt: "2026-10-21T03:00:00.000Z",
  updatedAt: "2026-10-21T03:00:00.000Z",
  customer: { fullName: "Lê Văn C", phone: "0901234567", address: "1 Trần Phú, Hà Đông, Hà Nội" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [],
  subtotal: 0,
  shippingFee: 0,
  total: 0,
});

describe("createJsonFileOrderRepository", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "shoplite-orders-"));
    file = path.join(dir, "nested", "orders.json");
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  it("trả về danh sách rỗng khi file chưa tồn tại", async () => {
    const repository = createJsonFileOrderRepository(file);
    expect(await repository.findAll()).toEqual([]);
    expect(await repository.findById("SL-1")).toBeNull();
  });

  it("tạo thư mục, ghi file và đọc lại được", async () => {
    const repository = createJsonFileOrderRepository(file);
    await repository.save(sampleOrder("SL-1"));

    const raw = JSON.parse(await readFile(file, "utf8"));
    expect(raw).toHaveLength(1);
    expect(await repository.findById("SL-1")).toMatchObject({ id: "SL-1" });
  });

  it("cập nhật đơn hàng đã tồn tại thay vì thêm bản sao", async () => {
    const repository = createJsonFileOrderRepository(file);
    await repository.save(sampleOrder("SL-1"));
    await repository.save({ ...sampleOrder("SL-1"), status: "cancelled" });

    const orders = await repository.findAll();
    expect(orders).toHaveLength(1);
    expect(orders[0].status).toBe("cancelled");
  });
});

describe.each([
  ["JSON", (file: string) => createJsonFileOrderRepository(file)],
  ["in-memory", () => createInMemoryOrderRepository()],
])("transaction (%s repository)", (_name, create) => {
  let dir: string;
  let file: string;
  let repository: OrderRepository;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "shoplite-orders-"));
    file = path.join(dir, "orders.json");
    repository = create(file);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("tx thấy dữ liệu đã commit cộng save của chính nó, rồi commit một lần", async () => {
    await repository.save(sampleOrder("SL-1"));
    await repository.transaction(async (tx) => {
      await tx.save(sampleOrder("SL-2"));
      expect((await tx.findAll()).map((o) => o.id)).toEqual(["SL-1", "SL-2"]);
      expect(await tx.findById("SL-2")).not.toBeNull();
      expect(await repository.findById("SL-2")).toBeNull(); // chưa commit
    });
    expect((await repository.findAll()).map((o) => o.id)).toEqual(["SL-1", "SL-2"]);
  });

  it("work ném lỗi thì không ghi gì, lỗi ném lại nguyên vẹn và hàng đợi vẫn chạy", async () => {
    const boom = new Error("boom");
    await expect(
      repository.transaction(async (tx) => {
        await tx.save(sampleOrder("SL-1"));
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(await repository.findAll()).toEqual([]);
    await repository.save(sampleOrder("SL-2"));
    expect(await repository.findById("SL-2")).not.toBeNull();
  });

  it("10 transaction đồng thời không mất đơn nào, đúng thứ tự gọi (FIFO)", async () => {
    await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        repository.transaction((tx) => tx.save(sampleOrder(`SL-${i}`))),
      ),
    );
    expect((await repository.findAll()).map((o) => o.id)).toEqual(
      Array.from({ length: 10 }, (_, i) => `SL-${i}`),
    );
  });

  it("hai transaction đọc-sửa-ghi cùng một đơn không thấy dữ liệu cũ của nhau", async () => {
    await repository.save({ ...sampleOrder("SL-1"), total: 0 });
    const bump = () =>
      repository.transaction(async (tx) => {
        const order = (await tx.findById("SL-1"))!;
        await tx.save({ ...order, total: order.total + 1 });
      });
    await Promise.all([bump(), bump(), bump()]);
    expect((await repository.findById("SL-1"))?.total).toBe(3);
  });

  it("gọi save hoặc transaction lồng bên trong work thì ném ngay, không treo", async () => {
    await expect(
      repository.transaction(async () => repository.save(sampleOrder("SL-1"))),
    ).rejects.toThrow(/bên trong transaction/);
    await expect(
      repository.transaction(async () => repository.transaction(async () => 1)),
    ).rejects.toThrow(/bên trong transaction/);
    expect(await repository.transaction(async () => "ok")).toBe("ok");
  }, 2000);
});

describe("createJsonFileOrderRepository - ghi file", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "shoplite-orders-"));
    file = path.join(dir, "orders.json");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("dùng tên .tmp duy nhất mỗi lần ghi", async () => {
    const renameSpy = vi.spyOn(fs.promises, "rename");
    const repository = createJsonFileOrderRepository(file);
    await repository.save(sampleOrder("SL-1"));
    await repository.save(sampleOrder("SL-2"));
    const temps = renameSpy.mock.calls.map(([from]) => String(from));
    expect(new Set(temps).size).toBe(2);
    for (const t of temps) expect(t).toMatch(/orders\.json\.\d+\.[0-9a-f-]{36}\.tmp$/);
  });

  it("rename lỗi thì xóa .tmp, giữ nguyên file gốc và snapshot", async () => {
    const repository = createJsonFileOrderRepository(file);
    await repository.save(sampleOrder("SL-1"));
    const before = await readFile(file, "utf8");
    vi.spyOn(fs.promises, "rename").mockRejectedValueOnce(new Error("rename lỗi"));
    await expect(repository.save(sampleOrder("SL-2"))).rejects.toThrow("rename lỗi");
    expect(await readFile(file, "utf8")).toBe(before);
    expect((await repository.findAll()).map((o) => o.id)).toEqual(["SL-1"]);
    expect(await readdir(dir)).toEqual(["orders.json"]);
  });
});

describe("createJsonFileOrderRepository - snapshot dùng chung", () => {
  let dir: string;
  let file: string;

  beforeEach(async () => {
    dir = await mkdtemp(path.join(tmpdir(), "shoplite-orders-"));
    file = path.join(dir, "orders.json");
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await rm(dir, { recursive: true, force: true });
  });

  it("cùng đường dẫn (kể cả viết khác nhau) dùng chung một repository", () => {
    const a = createJsonFileOrderRepository(file);
    const b = createJsonFileOrderRepository(path.join(dir, "x", "..", "orders.json"));
    expect(b).toBe(a);
    expect(createJsonFileOrderRepository(path.join(dir, "khac.json"))).not.toBe(a);
  });

  it("nạp lười và chỉ đọc đĩa một lần cho nhiều lần đọc", async () => {
    await writeFile(file, JSON.stringify([sampleOrder("SL-1")]));
    const readSpy = vi.spyOn(fs.promises, "readFile");
    const repository = createJsonFileOrderRepository(file);
    expect(readSpy).not.toHaveBeenCalled();
    await repository.findAll();
    await repository.findById("SL-1");
    await repository.findAll();
    expect(readSpy).toHaveBeenCalledTimes(1);
  });

  it.each([
    ["JSON hỏng", '{"fullName": "Nguyễn PII-DAC-TRUNG", '],
    ["không phải mảng", '{"phone": "0900PII-DAC-TRUNG"}'],
  ])("file %s: ném lỗi đã làm sạch, không ghi đè", async (_label, content) => {
    await writeFile(file, content);
    const repository = createJsonFileOrderRepository(file);
    const error = await repository.findAll().catch((e: unknown) => e as Error);
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain("PII-DAC-TRUNG");
    expect((error as Error).cause).toBeUndefined();
    await expect(repository.save(sampleOrder("SL-1"))).rejects.toThrow();
    expect(await readFile(file, "utf8")).toBe(content);
  });

  it("file chưa có (ENOENT) coi là rỗng và được tạo khi ghi", async () => {
    const repository = createJsonFileOrderRepository(file);
    expect(await repository.findAll()).toEqual([]);
    await repository.save(sampleOrder("SL-1"));
    expect(JSON.parse(await readFile(file, "utf8"))).toHaveLength(1);
  });

  it.each([
    ["JSON", () => createJsonFileOrderRepository(file)],
    ["in-memory", () => createInMemoryOrderRepository()],
  ])("%s: dữ liệu trả về bất biến sâu", async (_name, create) => {
    const repository = create();
    const item = { productId: "p1", quantity: 1 } as Order["items"][number];
    await repository.save({ ...sampleOrder("SL-1"), items: [item, { ...item, productId: "p2" }] });
    const [order] = await repository.findAll();
    expect(() => {
      (order as { status: string }).status = "x";
    }).toThrow(TypeError);
    expect(() => (order.items as unknown[]).push(1)).toThrow(TypeError);
    expect(() => ((order.customer as { fullName: string }).fullName = "x")).toThrow(TypeError);
    expect(() => (order.items as unknown[]).sort(() => 0)).toThrow(TypeError);
  });

  it("file bị tiến trình khác ghi lại thì hủy commit, nạp lại và không ghi đè", async () => {
    const repository = createJsonFileOrderRepository(file);
    await repository.save(sampleOrder("SL-1"));
    const external = JSON.stringify([sampleOrder("SL-NGOAI"), sampleOrder("SL-NGOAI-2")]);
    await writeFile(file, external);
    await expect(repository.save(sampleOrder("SL-2"))).rejects.toThrow(/thay đổi từ bên ngoài/);
    expect(await readFile(file, "utf8")).toBe(external);
    // đã nạp lại: thấy dữ liệu ngoài, và commit kế tiếp không báo nhầm
    expect((await repository.findAll()).map((o) => o.id)).toEqual(["SL-NGOAI", "SL-NGOAI-2"]);
    await repository.save(sampleOrder("SL-3"));
    await repository.save(sampleOrder("SL-4"));
    expect((await repository.findAll()).map((o) => o.id)).toEqual([
      "SL-NGOAI",
      "SL-NGOAI-2",
      "SL-3",
      "SL-4",
    ]);
  });
});
