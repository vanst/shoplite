import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { StoredOrder } from "@/features/orders/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { AdminOrderDetail } from "./admin-order-detail";

const base = {
  id: "SL-20261121-AAAAAA",
  status: "cancelled",
  createdAt: "2026-11-21T03:00:00.000Z",
  updatedAt: "2026-11-21T04:00:00.000Z",
  customer: { fullName: "Nguyễn Văn A", phone: "0912345678", address: "1 A, Quận 1, TP.HCM" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [],
  subtotal: 0,
  shippingFee: 0,
  total: 0,
} as unknown as StoredOrder;
const now = new Date("2026-11-21T05:00:00.000Z");
const show = (extra: Record<string, unknown>) =>
  render(<AdminOrderDetail order={{ ...base, ...extra } as StoredOrder} now={now} />);

describe("<AdminOrderDetail /> đơn đã hủy", () => {
  it("Từ chối: nhãn cạnh 'Đặt lúc', không nút thao tác, có Lịch sử trạng thái ở cuối", () => {
    show({ cancelledBy: "staff", cancelReason: "customer_cancelled" });
    expect(screen.getByText(/Đặt lúc .* · Từ chối · Khách hủy/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
    const headings = screen.getAllByRole("heading", { level: 2 }).map((h) => h.textContent);
    expect(headings.at(-1)).toBe("Lịch sử trạng thái");
    const entries = within(screen.getByTestId("status-timeline")).getAllByTestId("timeline-entry");
    expect(entries[0]).toHaveTextContent("Đã hủy");
    expect(entries[1]).toHaveTextContent("Đặt hàng");
  });

  it("Khách tự hủy", () => {
    show({ cancelledBy: "customer" });
    expect(screen.getByText(/Đặt lúc .* · Khách tự hủy/)).toBeInTheDocument();
  });

  it("đơn cũ thiếu cancelledBy: không nhãn, vẫn có timeline suy ra", () => {
    show({});
    expect(screen.getByText(/^Đặt lúc [^·]*$/)).toBeInTheDocument();
    expect(screen.getAllByTestId("timeline-entry")).toHaveLength(2);
  });
});
