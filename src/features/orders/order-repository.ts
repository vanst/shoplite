import { AsyncLocalStorage } from "node:async_hooks";
import { promises as fs } from "node:fs";
import path from "node:path";
import { singleton } from "@/lib/process-singleton";
import { deepFreeze, type Order, type StoredOrder } from "./types";

/** Phạm vi một transaction: thấy snapshot đã commit cộng các `save` của chính nó. */
export interface OrderTransaction {
  findAll(): Promise<StoredOrder[]>;
  findById(id: string): Promise<StoredOrder | null>;
  save(order: StoredOrder): Promise<void>;
}

/** Nơi lưu trữ đơn hàng. Có thể thay bằng database thật mà không đổi order-service. */
export interface OrderRepository {
  findAll(): Promise<StoredOrder[]>;
  findById(id: string): Promise<StoredOrder | null>;
  /** Thêm mới hoặc cập nhật (theo id). Tương đương `transaction((tx) => tx.save(order))`. */
  save(order: StoredOrder): Promise<void>;
  /**
   * Chạy `work` tuần tự (FIFO) với các transaction khác; các `save` được gom và ghi một lần
   * nguyên tử khi `work` trả về. `work` ném lỗi thì không ghi gì. Trong `work` chỉ dùng `tx`,
   * gọi `save`/`transaction` của repository sẽ ném lỗi lập trình (tránh treo hàng đợi).
   */
  transaction<T>(work: (tx: OrderTransaction) => Promise<T>): Promise<T>;
}

export const DEFAULT_ORDERS_FILE = path.join(process.cwd(), "storage", "orders.json");

interface OrderBackend {
  /** Snapshot đã commit (bất biến sâu); không được sửa tại chỗ. */
  read(): Promise<readonly StoredOrder[]>;
  write(orders: readonly StoredOrder[]): Promise<void>;
}

/** Lõi chung cho mọi repository: hàng đợi FIFO + gom ghi nguyên tử + chặn gọi lồng. */
function createTransactionalRepository(backend: OrderBackend): OrderRepository {
  const inTransaction = new AsyncLocalStorage<true>();
  let tail: Promise<unknown> = Promise.resolve();

  function assertNotNested() {
    if (inTransaction.getStore()) {
      throw new Error(
        "Không gọi repository.save/transaction bên trong transaction; hãy dùng `tx` được truyền vào.",
      );
    }
  }

  const repository: OrderRepository = {
    async findAll() {
      return [...(await backend.read())];
    },

    async findById(id) {
      return (await backend.read()).find((order) => order.id === id) ?? null;
    },

    save: (order) => repository.transaction((tx) => tx.save(order)),

    transaction<T>(work: (tx: OrderTransaction) => Promise<T>): Promise<T> {
      assertNotNested();
      const run = async (): Promise<T> => {
        const orders = [...(await backend.read())];
        let dirty = false;
        const tx: OrderTransaction = {
          async findAll() {
            return [...orders];
          },
          async findById(id) {
            return orders.find((order) => order.id === id) ?? null;
          },
          async save(order) {
            const stored = deepFreeze(structuredClone(order));
            const index = orders.findIndex((item) => item.id === order.id);
            if (index >= 0) orders[index] = stored;
            else orders.push(stored);
            dirty = true;
          },
        };
        const result = await inTransaction.run(true, () => work(tx));
        if (dirty) await backend.write(orders);
        return result;
      };
      const result = tail.then(run);
      tail = result.catch(() => undefined);
      return result;
    },
  };
  return repository;
}

interface FileStamp {
  mtimeMs: number;
  size: number;
}

async function statOrNull(filePath: string): Promise<FileStamp | null> {
  try {
    const { mtimeMs, size } = await fs.stat(filePath);
    return { mtimeMs, size };
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

const sameStamp = (a: FileStamp | null, b: FileStamp | null) =>
  a === b || (!!a && !!b && a.mtimeMs === b.mtimeMs && a.size === b.size);

/**
 * Lưu đơn hàng vào một file JSON - đủ dùng cho một tiến trình Node, không dùng cho nhiều instance.
 * Cùng đường dẫn (đã `resolve`) thì dùng chung một repository: một hàng đợi, một snapshot.
 */
export function createJsonFileOrderRepository(filePath: string): OrderRepository {
  const resolved = path.resolve(filePath);
  return singleton(`orders-repo:${resolved}`, () => {
    let snapshot: readonly StoredOrder[] | null = null; // nạp lười ở lần dùng đầu tiên
    let stamp: FileStamp | null = null;

    return createTransactionalRepository({
      async read() {
        if (snapshot) return snapshot;
        // stat trước khi đọc: nếu file đổi giữa hai bước, lần commit sau sẽ thấy lệch.
        const before = await statOrNull(resolved);
        let orders: unknown[] = [];
        if (before) {
          let data: unknown;
          try {
            data = JSON.parse(await fs.readFile(resolved, "utf8"));
          } catch (error) {
            if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
              // Không đính kèm cause: thông báo lỗi của JSON.parse có thể trích nội dung file (PII).
              throw new Error("File dữ liệu đơn hàng bị hỏng, không thể đọc");
            }
          }
          if (data !== undefined) {
            if (!Array.isArray(data)) {
              throw new Error("File dữ liệu đơn hàng sai định dạng, không phải danh sách");
            }
            orders = data;
          }
        }
        stamp = before;
        snapshot = deepFreeze(orders as Order[]);
        return snapshot;
      },

      async write(orders) {
        if (!sameStamp(stamp, await statOrNull(resolved))) {
          snapshot = null; // nạp lại ở lần dùng sau
          throw new Error(
            "File đơn hàng đã bị thay đổi từ bên ngoài, đã hủy ghi để tránh mất dữ liệu",
          );
        }
        await fs.mkdir(path.dirname(resolved), { recursive: true });
        const tempFile = `${resolved}.${process.pid}.${crypto.randomUUID()}.tmp`;
        try {
          await fs.writeFile(tempFile, JSON.stringify(orders, null, 2), "utf8");
          await fs.rename(tempFile, resolved);
        } catch (error) {
          await fs.rm(tempFile, { force: true });
          throw error;
        }
        stamp = await statOrNull(resolved);
        snapshot = orders;
      },
    });
  });
}

/** Repository trong bộ nhớ - dùng cho unit test. */
export function createInMemoryOrderRepository(seed: readonly StoredOrder[] = []): OrderRepository {
  let orders: readonly StoredOrder[] = deepFreeze(structuredClone(seed) as Order[]);
  return createTransactionalRepository({
    async read() {
      return orders;
    },
    async write(next) {
      orders = next;
    },
  });
}
