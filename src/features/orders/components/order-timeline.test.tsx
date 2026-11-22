import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { OrderTimeline } from "./order-timeline";

describe("<OrderTimeline />", () => {
  it("xếp mới nhất trên cùng, mốc đó có aria-current=step", () => {
    render(
      <OrderTimeline
        title="Hành trình đơn hàng"
        entries={[
          { label: "Đặt hàng", at: "2026-11-21T03:00:00.000Z" },
          { label: "Đã xác nhận", at: "2026-11-21T05:00:00.000Z" },
        ]}
      />,
    );
    expect(screen.getByRole("heading", { level: 2, name: "Hành trình đơn hàng" })).toBeVisible();
    const items = within(
      screen.getByRole("list", { name: "Hành trình đơn hàng, mới nhất trước" }),
    ).getAllByRole("listitem");
    expect(items[0]).toHaveTextContent("Đã xác nhận");
    expect(items[0]).toHaveAttribute("aria-current", "step");
    expect(items[1]).toHaveTextContent("Đặt hàng");
    expect(items[1]).not.toHaveAttribute("aria-current");
  });

  it("đơn mới chỉ có một mốc Đặt hàng", () => {
    render(
      <OrderTimeline
        title="Lịch sử trạng thái"
        entries={[{ label: "Đặt hàng", at: "2026-11-21T03:00:00.000Z" }]}
      />,
    );
    expect(screen.getAllByTestId("timeline-entry")).toHaveLength(1);
  });
});
