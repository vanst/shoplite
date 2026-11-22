import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { addRecentOrder } from "../recent-orders-store";
import { OrderLookupWithRecent } from "./order-lookup-with-recent";

const id = (n: number) => `SL-20261021-00000${n}`;

describe("<OrderLookupWithRecent />", () => {
  it("chưa hydrate không render danh sách (HTML server không có mã)", () => {
    addRecentOrder(id(1));
    expect(renderToString(<OrderLookupWithRecent />)).not.toContain("Đơn đã đặt trên máy này");
  });

  it("không có mã nào thì ẩn hoàn toàn", () => {
    render(<OrderLookupWithRecent />);
    expect(screen.queryByText("Đơn đã đặt trên máy này")).toBeNull();
    expect(screen.queryByTestId("recent-order")).toBeNull();
  });

  it("hiện tối đa 5 mã, mới nhất trên cùng", () => {
    for (let n = 1; n <= 6; n++) addRecentOrder(id(n));
    render(<OrderLookupWithRecent />);
    expect(screen.getByRole("heading", { name: "Đơn đã đặt trên máy này" })).toBeInTheDocument();
    expect(screen.getAllByTestId("recent-order").map((b) => b.textContent)).toEqual([
      id(6),
      id(5),
      id(4),
      id(3),
      id(2),
    ]);
  });

  it("bấm mã: điền ô Mã đơn, focus sang ô 4 số cuối, không tự gửi", async () => {
    addRecentOrder(id(1));
    render(<OrderLookupWithRecent />);
    await userEvent.click(screen.getByTestId("recent-order"));
    expect(screen.getByLabelText("Mã đơn")).toHaveValue(id(1));
    expect(screen.getByLabelText("4 số cuối số điện thoại")).toHaveFocus();
    expect(screen.queryByTestId("lookup-error")).toBeNull();
  });
});
