import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderSuccessBanner } from "./order-success-banner";

describe("<OrderSuccessBanner />", () => {
  it("nhận focus khi mount, không role, chỉ nêu mã đơn", () => {
    const { container } = render(<OrderSuccessBanner orderId="SL-20261021-ABC123" />);
    const banner = container.firstElementChild as HTMLElement;
    expect(banner).toHaveFocus();
    expect(banner).not.toHaveAttribute("role");
    expect(banner).toHaveAttribute("tabindex", "-1");
    expect(screen.getByText("Đặt hàng thành công!")).toBeInTheDocument();
    expect(banner).toHaveTextContent(
      "Lưu mã đơn SL-20261021-ABC123 và 4 số cuối số điện thoại để tra cứu sau",
    );
  });
});
