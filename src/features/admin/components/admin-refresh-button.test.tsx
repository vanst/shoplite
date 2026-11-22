import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

import { AdminRefreshButton } from "./admin-refresh-button";

describe("<AdminRefreshButton />", () => {
  it("bấm thì gọi router.refresh rồi hiện thông báo nhận focus", async () => {
    render(<AdminRefreshButton />);
    fireEvent.click(screen.getByRole("button", { name: "Làm mới" }));
    expect(refresh).toHaveBeenCalledOnce();
    const notice = await screen.findByTestId("status-notice");
    expect(notice).toHaveTextContent("Đã làm mới danh sách");
    expect(notice).toHaveFocus();
  });
});
