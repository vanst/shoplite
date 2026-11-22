import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CancelOrderButton } from "./cancel-order-button";
import { RejectionNotice } from "./rejection-notice";

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

const ID = "SL-20261021-ABC123";

function jsonError(status: number, message: string) {
  return new Response(JSON.stringify({ error: { code: "X", message } }), { status });
}

async function openDialog(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const user = userEvent.setup();
  render(
    <>
      <h1 tabIndex={-1}>Đơn hàng</h1>
      <CancelOrderButton orderId={ID} />
    </>,
  );
  await user.click(screen.getByRole("button", { name: "Hủy đơn hàng" }));
  return user;
}

describe("<CancelOrderButton />", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    refresh.mockReset();
  });

  it("mở hộp xác nhận: group có nhãn, nút xác nhận nhận focus; bấm Không trả focus về nút Hủy", async () => {
    const user = await openDialog(vi.fn());
    const group = screen.getByRole("group");
    expect(group).toHaveAccessibleName("Bạn chắc chắn muốn hủy đơn hàng này?");
    const confirm = screen.getByRole("button", { name: "Xác nhận hủy" });
    expect(confirm).toHaveFocus();
    expect(confirm).toHaveAccessibleDescription("Bạn chắc chắn muốn hủy đơn hàng này?");

    await user.click(screen.getByRole("button", { name: "Không" }));
    expect(screen.queryByRole("group")).toBeNull();
    expect(screen.getByRole("button", { name: "Hủy đơn hàng" })).toHaveFocus();
  });

  it("thành công: gửi PATCH, tải lại dữ liệu, focus chuyển sang RejectionNotice khi nó xuất hiện", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    const user = await openDialog(fetchMock);
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy" }));

    expect(fetchMock).toHaveBeenCalledWith(
      `/api/orders/${ID}`,
      expect.objectContaining({ method: "PATCH", body: JSON.stringify({ status: "cancelled" }) }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
    render(<RejectionNotice cancelledBy="customer" />);
    expect(screen.getByTestId("rejection-notice")).toHaveFocus();
  });

  it("đang gửi: nút hiện Đang hủy… và bị khóa", async () => {
    const fetchMock = vi.fn().mockReturnValue(new Promise(() => {}));
    const user = await openDialog(fetchMock);
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy" }));
    expect(screen.getByRole("button", { name: "Đang hủy…" })).toBeDisabled();
  });

  it("409: hiện message server trong hộp (có focus, không role) và tải lại dữ liệu", async () => {
    const msg = "Chỉ có thể hủy đơn đang chờ xác nhận";
    const user = await openDialog(vi.fn().mockResolvedValue(jsonError(409, msg)));
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy" }));

    const notice = await screen.findByText(msg);
    expect(notice).toHaveFocus();
    expect(notice).toHaveAttribute("tabindex", "-1");
    expect(notice).not.toHaveAttribute("role");
    expect(notice).not.toHaveTextContent("INVALID_STATUS_TRANSITION");
    expect(refresh).toHaveBeenCalled();
  });

  it("401: báo phiên hết kèm link Tra cứu lại, không tải lại trang", async () => {
    const user = await openDialog(vi.fn().mockResolvedValue(jsonError(401, "khác")));
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy" }));

    expect(await screen.findByText(/Phiên xem đơn đã hết, vui lòng tra cứu lại/)).toBeVisible();
    expect(screen.getByRole("link", { name: "Tra cứu lại" })).toHaveAttribute(
      "href",
      `/orders/${ID}`,
    );
    expect(refresh).not.toHaveBeenCalled();
  });

  it("mất mạng: hiện thông báo thay vì ném lỗi, nút hoạt động lại", async () => {
    const user = await openDialog(vi.fn().mockRejectedValue(new TypeError("fail")));
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy" }));

    expect(await screen.findByText("Không kết nối được máy chủ, vui lòng thử lại.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Xác nhận hủy" })).toBeEnabled();
  });

  it("lỗi không phải JSON: dùng fallback", async () => {
    const user = await openDialog(vi.fn().mockResolvedValue(new Response("oops", { status: 500 })));
    await user.click(screen.getByRole("button", { name: "Xác nhận hủy" }));

    expect(await screen.findByText("Không thể hủy đơn hàng")).toBeVisible();
  });
});
