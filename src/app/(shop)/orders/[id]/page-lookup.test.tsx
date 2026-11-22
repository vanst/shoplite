// @vitest-environment node
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({ cookies: async () => ({ get: () => undefined }) }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/features/orders/server", async () => {
  const { createOrderService } = await import("@/features/orders/order-service");
  const { createInMemoryOrderRepository } = await import("@/features/orders/order-repository");
  return { orderService: createOrderService({ repository: createInMemoryOrderRepository() }) };
});

import OrderDetailPage from "./page";

const render = async (id: string) =>
  renderToStaticMarkup(
    await OrderDetailPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({}),
    } as Parameters<typeof OrderDetailPage>[0]),
  );

describe("trang /orders/[id] khi chưa có grant", () => {
  it("hiện form tra cứu điền sẵn mã đơn đã chuẩn hóa", async () => {
    const html = await render("sl-20260101-abcdef");
    expect(html).toContain("Tra cứu đơn hàng");
    expect(html).toContain("Nhập 4 số cuối số điện thoại để xem đơn này.");
    expect(html).toContain('value="SL-20260101-ABCDEF"');
  });

  it("HTML chỉ khác ở mã đơn điền sẵn, không phụ thuộc đơn có tồn tại", async () => {
    const a = await render("SL-20260101-AAAAAA");
    const b = await render("SL-20260101-BBBBBB");
    expect(a.replaceAll("AAAAAA", "X")).toBe(b.replaceAll("BBBBBB", "X"));
  });

  it("mã đơn quá dài thì để trống ô mã đơn thay vì lỗi", async () => {
    expect(await render("A".repeat(40))).not.toContain("AAAA");
  });
});
