import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProductById } from "@/features/catalog/catalog-data";
import { toCartItem } from "@/features/cart/cart-reducer";
import { cartStore } from "@/features/cart/cart-store";
import { CartView } from "./cart-view";

function seedCart(entries: [productId: string, quantity: number][]) {
  for (const [productId, quantity] of entries) {
    cartStore.dispatch({ type: "add", item: toCartItem(getProductById(productId)!), quantity });
  }
}

describe("<CartView />", () => {
  beforeEach(() => {
    cartStore.reset();
    // Mặc định /api/stock lỗi: giữ stock cũ, không hiện lỗi
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
  });
  afterEach(() => vi.unstubAllGlobals());

  it("hiển thị trạng thái giỏ hàng trống", () => {
    render(<CartView />);
    expect(screen.getByText("Giỏ hàng của bạn đang trống")).toBeVisible();
  });

  it("hiển thị gợi ý mua thêm để được miễn phí giao hàng", () => {
    seedCart([["p010", 1]]); // 150.000đ
    render(<CartView />);

    expect(screen.getAllByTestId("cart-item")).toHaveLength(1);
    expect(screen.getByText(/Mua thêm 350\.000/)).toBeVisible();
    expect(screen.getByTestId("cart-total")).toHaveTextContent(/180\.000/);
  });

  it("cập nhật số lượng và tổng tiền", async () => {
    const user = userEvent.setup();
    seedCart([["p010", 1]]);
    render(<CartView />);

    const row = screen.getByTestId("cart-item");
    await user.click(within(row).getByRole("button", { name: "Tăng số lượng" }));

    expect(within(row).getByRole("spinbutton")).toHaveValue(2);
    expect(screen.getByTestId("cart-total")).toHaveTextContent(/330\.000/);
  });

  it("xóa sản phẩm khỏi giỏ", async () => {
    const user = userEvent.setup();
    seedCart([
      ["p010", 1],
      ["p006", 1],
    ]);
    render(<CartView />);

    await user.click(screen.getByRole("button", { name: /Xóa Cáp USB-C/ }));

    expect(screen.getAllByTestId("cart-item")).toHaveLength(1);
    expect(screen.queryByText("Cáp USB-C bện dù 2m")).not.toBeInTheDocument();
  });

  describe("đồng bộ tồn", () => {
    it("giỏ rỗng không gọi /api/stock", () => {
      render(<CartView />);
      expect(fetch).not.toHaveBeenCalled();
    });

    it("lỗi 500 giữ stock cũ, không hiện cảnh báo", async () => {
      seedCart([["p010", 2]]);
      render(<CartView />);
      await vi.waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
      expect(screen.queryByTestId("stock-warning")).not.toBeInTheDocument();
    });

    it("gọi một lần, báo 'Chỉ còn n sản phẩm' khi vượt tồn và giảm về mức còn lại thì hết cảnh báo", async () => {
      const user = userEvent.setup();
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ stock: { p010: 1 } }))),
      );
      seedCart([["p010", 3]]);
      render(<CartView />);

      expect(await screen.findByText("Chỉ còn 1 sản phẩm")).toBeVisible();
      expect(fetch).toHaveBeenCalledTimes(1);
      const row = screen.getByTestId("cart-item");
      await user.click(within(row).getByRole("button", { name: "Giảm số lượng" }));
      expect(within(row).getByRole("spinbutton")).toHaveValue(1);
      expect(screen.queryByTestId("stock-warning")).not.toBeInTheDocument();
    });

    it("dòng hết hàng báo 'Đã hết hàng', ẩn ô số lượng, chỉ còn nút xóa", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn().mockResolvedValue(new Response(JSON.stringify({ stock: {} }))),
      );
      seedCart([["p010", 2]]);
      render(<CartView />);

      expect(await screen.findByText("Đã hết hàng")).toBeVisible();
      expect(screen.queryByRole("spinbutton")).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Xóa Cáp USB-C/ })).toBeVisible();
      expect(cartStore.getSnapshot().items[0].quantity).toBe(2);
    });
  });
});
