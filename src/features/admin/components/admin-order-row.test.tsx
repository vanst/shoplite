import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { QueueRow } from "../queue-rules";
import { AdminOrderRow } from "./admin-order-row";

const ROW: QueueRow = {
  id: "SL-20261021-AAAAAA",
  status: "pending",
  createdAt: "2026-10-21T03:00:00.000Z",
  customerName: "Nguyễn Văn A",
  itemCount: 5,
  total: 123_000,
  ageLabel: "Chờ 3 giờ",
  overdue: false,
};

describe("<AdminOrderRow />", () => {
  it("mã đơn là link tới chi tiết, có tuổi đơn, tên khách và số sản phẩm", () => {
    render(
      <ul>
        <AdminOrderRow row={ROW} />
      </ul>,
    );
    expect(screen.getByRole("link", { name: ROW.id })).toHaveAttribute(
      "href",
      `/admin/orders/${ROW.id}`,
    );
    expect(screen.getByText("Chờ 3 giờ")).toBeInTheDocument();
    expect(screen.getByText(/Nguyễn Văn A · 5 sản phẩm/)).toBeInTheDocument();
    expect(screen.queryByTestId("overdue-age")).not.toBeInTheDocument();
  });

  it("đơn quá hạn có chữ 'Quá hạn' cho trình đọc màn hình", () => {
    render(
      <ul>
        <AdminOrderRow row={{ ...ROW, overdue: true }} />
      </ul>,
    );
    expect(screen.getByTestId("overdue-age")).toHaveTextContent("Quá hạn, Chờ 3 giờ");
    expect(screen.getByTestId("admin-order-row")).toHaveClass("border-rose-600");
  });

  it("đơn không pending không có tuổi đơn", () => {
    render(
      <ul>
        <AdminOrderRow row={{ ...ROW, status: "shipping", ageLabel: undefined }} />
      </ul>,
    );
    expect(screen.queryByText(/^Chờ/)).not.toBeInTheDocument();
  });

  it("đơn hủy: hàng 2 thêm nhãn sau số sản phẩm; đơn cũ không thêm gì", () => {
    const done = { ...ROW, status: "cancelled" as const, ageLabel: undefined };
    const { rerender } = render(
      <ul>
        <AdminOrderRow row={{ ...done, cancelLabel: "Từ chối · Hết hàng" }} />
      </ul>,
    );
    expect(screen.getByText(/5 sản phẩm · Từ chối · Hết hàng/)).toBeInTheDocument();
    rerender(
      <ul>
        <AdminOrderRow row={{ ...done, cancelLabel: "Khách tự hủy" }} />
      </ul>,
    );
    expect(screen.getByText(/5 sản phẩm · Khách tự hủy/)).toBeInTheDocument();
    rerender(
      <ul>
        <AdminOrderRow row={done} />
      </ul>,
    );
    expect(screen.getByText(/5 sản phẩm$/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).toBeNull();
  });
});
