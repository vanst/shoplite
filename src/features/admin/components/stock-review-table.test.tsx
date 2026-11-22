import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { StockReviewTable } from "./stock-review-table";

const image = { emoji: "🔌", from: "#fff", to: "#000" };
const item = (productId: string, name: string, quantity: number) => ({
  productId,
  slug: productId,
  name,
  image,
  unitPrice: 1,
  quantity,
  lineTotal: quantity,
});

describe("StockReviewTable", () => {
  it("có caption sr-only, th scope col/row, ảnh aria-hidden và tên món không phải link", () => {
    render(<StockReviewTable items={[item("a", "Cáp", 2)]} stock={{ a: 5 }} pendingOthers={{}} />);
    expect(screen.getByRole("table", { name: "Tồn kho các món" })).toBeInTheDocument();
    expect(screen.getByText("Tồn kho các món").className).toContain("sr-only");
    for (const name of ["Sản phẩm", "Đặt", "Tồn hiện tại", "Đang chờ (đơn khác)"]) {
      expect(screen.getByRole("columnheader", { name })).toHaveAttribute("scope", "col");
    }
    expect(screen.getByRole("rowheader", { name: /Cáp/ })).toHaveAttribute("scope", "row");
    expect(screen.queryByRole("img")).toBeNull();
    expect(screen.queryByRole("link")).toBeNull();
    expect(screen.getByTestId("stock-current")).toHaveTextContent("5");
  });

  it("đánh dấu khi Đặt > Tồn, không đánh dấu khi Đặt bằng Tồn", () => {
    render(
      <StockReviewTable
        items={[item("a", "A", 1), item("b", "B", 4), item("c", "C", 3)]}
        stock={{ a: 0, b: 3, c: 3 }}
        pendingOthers={{}}
      />,
    );
    const rows = screen.getAllByTestId("stock-review-row");
    expect(rows).toHaveLength(3);
    expect(rows[0]).toHaveClass("bg-rose-50");
    expect(within(rows[0]).getByTestId("stock-short")).toHaveTextContent("Không đủ hàng");
    expect(within(rows[1]).getByTestId("stock-short")).toBeInTheDocument();
    expect(within(rows[2]).queryByTestId("stock-short")).toBeNull();
    expect(rows[2]).not.toHaveClass("bg-rose-50");
  });

  it("tồn thô âm hiển thị 0 và vẫn đánh dấu; món thiếu trong map coi như tồn 0", () => {
    render(
      <StockReviewTable
        items={[item("a", "A", 1), item("z", "Z", 1)]}
        stock={{ a: -2 }}
        pendingOthers={{}}
      />,
    );
    const [a, z] = screen.getAllByTestId("stock-review-row");
    expect(within(a).getByTestId("stock-current")).toHaveTextContent("0");
    expect(within(a).getByTestId("stock-short")).toBeInTheDocument();
    expect(within(z).getByTestId("stock-current")).toHaveTextContent("0");
    expect(within(z).getByTestId("stock-short")).toBeInTheDocument();
  });

  it("cột Đang chờ hiện số đơn khác theo món, thiếu = 0", () => {
    render(
      <StockReviewTable
        items={[item("a", "A", 1), item("b", "B", 1)]}
        stock={{ a: 3, b: 3 }}
        pendingOthers={{ a: 2 }}
      />,
    );
    const [a, b] = screen.getAllByTestId("stock-pending");
    expect(a).toHaveTextContent("2");
    expect(b).toHaveTextContent("0");
  });
});
