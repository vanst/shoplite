import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin",
}));

import { AdminHeader } from "./admin-header";

describe("<AdminHeader />", () => {
  it("chưa đăng nhập: chỉ có chữ Quản trị, không có nút Đăng xuất hay link", () => {
    render(<AdminHeader loggedIn={false} />);
    expect(screen.getByText("Quản trị")).toBeVisible();
    expect(screen.queryByTestId("admin-logout")).toBeNull();
    expect(screen.queryByTestId("admin-phone-search")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
  });

  it("đã đăng nhập: có nút Đăng xuất", () => {
    render(<AdminHeader loggedIn />);
    expect(screen.getByTestId("admin-logout")).toHaveTextContent("Đăng xuất");
    expect(screen.getByTestId("admin-phone-search")).toBeInTheDocument();
  });
});
