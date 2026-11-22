import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { AdminQueueList } from "./admin-queue-list";

describe("<AdminQueueList />", () => {
  it("notice từ URL: hiện, nhận focus rồi gỡ tham số bằng router.replace", () => {
    render(
      <AdminQueueList tab="pending" rows={[]} emptyTitle="Trống" urlNotice="Đã xác nhận đơn X" />,
    );
    const notice = screen.getByTestId("status-notice");
    expect(notice).toHaveTextContent("Đã xác nhận đơn X");
    expect(notice).toHaveFocus();
    expect(router.replace).toHaveBeenCalledWith("/admin?tab=pending", { scroll: false });
    expect(screen.getByText("Trống")).toBeInTheDocument();
  });

  it("không có notice thì không hiện và không replace", () => {
    router.replace.mockClear();
    render(<AdminQueueList tab="pending" rows={[]} emptyTitle="Trống" />);
    expect(screen.queryByTestId("status-notice")).not.toBeInTheDocument();
    expect(router.replace).not.toHaveBeenCalled();
  });
});
