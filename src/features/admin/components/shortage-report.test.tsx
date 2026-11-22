import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getProductById } from "@/features/catalog/catalog-data";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { OrderActionError, OrderActionsProvider } from "./order-actions";
import { ShortageReport } from "./shortage-report";

const ID = "SL-20261021-ABC123";
const fetchMock = vi.fn();
const reply = (status: number, body?: unknown) =>
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );

const item = (id: string) => {
  const p = getProductById(id)!;
  return {
    productId: p.id,
    slug: p.slug,
    name: p.name,
    image: p.image,
    unitPrice: p.price,
    quantity: 2,
    lineTotal: p.price * 2,
  };
};
const items = [item("p010"), item("p001")];

function setup() {
  render(
    <OrderActionsProvider orderId={ID}>
      <OrderActionError />
      <ShortageReport items={items} />
    </OrderActionsProvider>,
  );
}
const openButton = (i: number) =>
  screen.getByRole("button", { name: `Báo thiếu hàng: ${items[i].name}` });

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("<ShortageReport />", () => {
  it("mỗi dòng có nút với aria-label/aria-expanded; chưa mở thì chưa có hộp", () => {
    setup();
    expect(screen.getAllByTestId("shortage-report-button")).toHaveLength(2);
    expect(openButton(0)).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByTestId("shortage-confirm")).toBeNull();
  });

  it("mở hộp: có câu cảnh báo, focus vào nút xác nhận, chỉ một hộp tại một thời điểm", () => {
    setup();
    fireEvent.click(openButton(0));
    expect(
      screen.getByText(
        `Đơn sẽ bị từ chối với lý do Hết hàng và tồn của ${items[0].name} được điều chỉnh.`,
      ),
    ).toBeInTheDocument();
    expect(screen.getByTestId("shortage-confirm")).toHaveFocus();
    expect(openButton(0)).toHaveAttribute("aria-expanded", "true");
    fireEvent.click(openButton(1));
    expect(screen.getAllByTestId("shortage-confirm")).toHaveLength(1);
    expect(openButton(0)).toHaveAttribute("aria-expanded", "false");
  });

  it("Thôi đóng hộp và trả focus về nút đã mở", () => {
    setup();
    fireEvent.click(openButton(0));
    fireEvent.click(screen.getByRole("button", { name: "Thôi" }));
    expect(screen.queryByTestId("shortage-confirm")).toBeNull();
    expect(openButton(0)).toHaveFocus();
  });

  it("xác nhận gửi { from, to, reason, productId } rồi chuyển tới tab Đã xác nhận kèm notice shortage", async () => {
    reply(200, {});
    setup();
    fireEvent.click(openButton(0));
    fireEvent.click(screen.getByTestId("shortage-confirm"));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/admin?tab=confirmed&notice=shortage&order=${ID}`),
    );
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      from: "confirmed",
      to: "cancelled",
      reason: "out_of_stock",
      productId: "p010",
    });
  });

  it("409 hiện ErrorBanner và tải lại; 500 hiện lỗi chung, hộp giữ nguyên", async () => {
    reply(409, {
      error: { code: "ORDER_STATUS_CONFLICT", message: "Đơn đã được cập nhật ở nơi khác" },
    });
    setup();
    fireEvent.click(openButton(0));
    fireEvent.click(screen.getByTestId("shortage-confirm"));
    expect(await screen.findByText("Đơn đã được cập nhật ở nơi khác")).toBeInTheDocument();
    expect(router.refresh).toHaveBeenCalled();

    reply(500, { error: { code: "INTERNAL_ERROR", message: "x" } });
    await waitFor(() => expect(screen.getByTestId("shortage-confirm")).not.toBeDisabled());
    fireEvent.click(screen.getByTestId("shortage-confirm"));
    expect(await screen.findByText("Đã có lỗi xảy ra, vui lòng thử lại sau")).toBeInTheDocument();
    expect(screen.getByTestId("shortage-confirm")).toBeInTheDocument();
  });

  it("401 chuyển tới đăng nhập", async () => {
    reply(401, { error: { code: "UNAUTHORIZED", message: "x" } });
    setup();
    fireEvent.click(openButton(0));
    fireEvent.click(screen.getByTestId("shortage-confirm"));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(expect.stringContaining("/admin/login?next=")),
    );
  });
});
