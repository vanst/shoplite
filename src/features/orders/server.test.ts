// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const { createJsonFileOrderRepository } = vi.hoisted(() => ({
  createJsonFileOrderRepository: vi.fn(() => ({})),
}));

vi.mock("./order-repository", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./order-repository")>()),
  createJsonFileOrderRepository,
}));

async function loadServer() {
  vi.resetModules();
  createJsonFileOrderRepository.mockClear();
  await import("./server");
  const { DEFAULT_ORDERS_FILE } = await import("./order-repository");
  return DEFAULT_ORDERS_FILE;
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("orderService (server.ts) chọn file đơn hàng", () => {
  it("dùng file mặc định khi ORDERS_FILE là chuỗi rỗng", async () => {
    vi.stubEnv("ORDERS_FILE", "");
    const defaultFile = await loadServer();
    expect(createJsonFileOrderRepository).toHaveBeenCalledExactlyOnceWith(defaultFile);
  });

  it("dùng file mặc định khi chưa đặt ORDERS_FILE", async () => {
    vi.stubEnv("ORDERS_FILE", undefined);
    const defaultFile = await loadServer();
    expect(createJsonFileOrderRepository).toHaveBeenCalledExactlyOnceWith(defaultFile);
  });

  it("giữ nguyên giá trị ORDERS_FILE khi có đặt", async () => {
    vi.stubEnv("ORDERS_FILE", "/tmp/shoplite-test-orders.json");
    await loadServer();
    expect(createJsonFileOrderRepository).toHaveBeenCalledExactlyOnceWith(
      "/tmp/shoplite-test-orders.json",
    );
  });
});
