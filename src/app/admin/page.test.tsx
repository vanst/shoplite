import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { requireAdmin, listOrders } = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  listOrders: vi.fn(),
}));
vi.mock("@/features/admin/admin-guard", () => ({ requireAdmin }));
vi.mock("@/features/orders/server", () => ({ orderService: { listOrders } }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh: vi.fn() }) }));

import AdminPage, { generateMetadata } from "./page";

const order = (id: string, status: string, createdAt: string, updatedAt = createdAt) => ({
  id,
  status,
  createdAt,
  updatedAt,
  customer: { fullName: "Khách " + id, phone: "0912345678", address: "x" },
  items: [{ quantity: 1 }],
  total: 1000,
});

const props = (tab?: string) =>
  ({ searchParams: Promise.resolve(tab === undefined ? {} : { tab }) }) as never;

beforeEach(() => {
  requireAdmin.mockReset().mockResolvedValue({});
  listOrders
    .mockReset()
    .mockResolvedValue([
      order("P2", "pending", "2026-10-21T02:00:00.000Z"),
      order("P1", "pending", "2026-10-21T01:00:00.000Z"),
      order("C1", "confirmed", "2026-10-21T01:00:00.000Z"),
      order("D1", "delivered", "2026-10-21T01:00:00.000Z"),
    ]);
});

describe("trang /admin", () => {
  it("gọi requireAdmin với đúng đường dẫn /admin trước khi đọc đơn", async () => {
    await AdminPage(props());
    expect(requireAdmin).toHaveBeenCalledExactlyOnceWith("/admin");
  });

  it("mặc định tab pending: đơn cũ nhất trên và số đếm từng tab", async () => {
    render(await AdminPage(props()));
    const rows = screen.getAllByTestId("admin-order-row");
    expect(rows.map((r) => within(r).getByRole("link").textContent)).toEqual(["P1", "P2"]);
    const counts = screen.getAllByTestId("admin-tab-count").map((c) => c.textContent);
    expect(counts).toEqual(["2 đơn", "1 đơn", "0 đơn", "1 đơn"]);
  });

  it("tab lạ coi như pending", async () => {
    render(await AdminPage(props("abc")));
    expect(screen.getByTestId("admin-tab-pending")).toHaveAttribute("aria-current", "page");
  });

  it("tab shipping rỗng hiện EmptyState", async () => {
    render(await AdminPage(props("shipping")));
    expect(screen.getByText("Không còn đơn nào cần xử lý")).toBeInTheDocument();
  });

  it("title là nhãn tab kèm số đếm, không chứa tên khách", async () => {
    const meta = await generateMetadata(props("pending"));
    expect(meta.title).toBe("Chờ xác nhận (2) · Quản trị");
  });
});
