import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { RejectionNotice } from "./rejection-notice";

describe("<RejectionNotice />", () => {
  it("nhân viên từ chối: hiện lý do, không có link khi không có categoryHref", () => {
    render(<RejectionNotice cancelledBy="staff" reasonLabel="Khách hủy" />);
    expect(screen.getByTestId("rejection-notice")).toHaveTextContent(
      "Shop đã từ chối đơn, lý do: Khách hủy",
    );
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("hết hàng: có link danh mục", () => {
    render(
      <RejectionNotice
        cancelledBy="staff"
        reasonLabel="Hết hàng"
        categoryHref="/products?category=am-thanh"
      />,
    );
    expect(screen.getByRole("link", { name: "Xem sản phẩm cùng danh mục" })).toHaveAttribute(
      "href",
      "/products?category=am-thanh",
    );
  });

  it("khách tự hủy: 'Bạn đã hủy đơn', không role, tabIndex -1", () => {
    render(<RejectionNotice cancelledBy="customer" />);
    const notice = screen.getByTestId("rejection-notice");
    expect(notice).toHaveTextContent("Bạn đã hủy đơn");
    expect(notice).toHaveAttribute("tabindex", "-1");
    expect(notice).not.toHaveAttribute("role");
  });
});
