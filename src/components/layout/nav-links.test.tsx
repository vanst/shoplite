import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const pathname = vi.hoisted(() => ({ value: "/" }));
vi.mock("next/navigation", () => ({ usePathname: () => pathname.value }));

import { NavLinks } from "./nav-links";

describe("<NavLinks />", () => {
  it("có link 'Tra cứu đơn' tới /orders, không có link vào /admin", () => {
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Tra cứu đơn" })).toHaveAttribute("href", "/orders");
    expect(screen.queryByRole("link", { name: "Đơn hàng" })).toBeNull();
    for (const link of screen.getAllByRole("link")) {
      expect(link.getAttribute("href")).not.toMatch(/^\/admin/);
    }
  });

  it("'Tra cứu đơn' active khi đường dẫn bắt đầu /orders", () => {
    pathname.value = "/orders/SL-20260101-ABCDEF";
    render(<NavLinks />);
    expect(screen.getByRole("link", { name: "Tra cứu đơn" })).toHaveClass("bg-indigo-50");
    expect(screen.getByRole("link", { name: "Sản phẩm" })).not.toHaveClass("bg-indigo-50");
  });
});
