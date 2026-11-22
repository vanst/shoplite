import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { LogoutButton } from "./logout-button";

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

describe("<LogoutButton />", () => {
  it("gọi API đăng xuất rồi chuyển tới trang đăng nhập", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<LogoutButton />);

    await userEvent.click(screen.getByTestId("admin-logout"));

    expect(fetchMock).toHaveBeenCalledWith("/api/admin/logout", { method: "POST" });
    expect(push).toHaveBeenCalledWith("/admin/login");
    expect(refresh).toHaveBeenCalledOnce();
  });

  it("vẫn chuyển trang khi fetch ném lỗi", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("mạng")));
    render(<LogoutButton />);

    await userEvent.click(screen.getByRole("button", { name: "Đăng xuất" }));

    expect(push).toHaveBeenCalledWith("/admin/login");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
