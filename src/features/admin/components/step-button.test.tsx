import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { QueueRow } from "../queue-rules";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

import { AdminQueueList } from "./admin-queue-list";
import { DetailStepButton } from "./detail-step-button";
import { OrderActionError, OrderActionsProvider } from "./order-actions";

const ID = "SL-20261021-ABC123";
const fetchMock = vi.fn();
const reply = (status: number, body?: unknown) =>
  fetchMock.mockResolvedValueOnce(
    new Response(body === undefined ? null : JSON.stringify(body), { status }),
  );

const row = (status: QueueRow["status"], id = ID): QueueRow => ({
  id,
  status,
  createdAt: "2026-10-21T03:00:00.000Z",
  customerName: "Nguyễn Văn A",
  itemCount: 1,
  total: 1000,
  overdue: false,
});

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe("StepButton trên dòng Hàng việc", () => {
  it("chỉ dòng confirmed/shipping có nút, nhãn đúng kèm mã đơn cho trình đọc màn hình", () => {
    render(
      <AdminQueueList
        tab="confirmed"
        emptyTitle="Trống"
        rows={[
          row("pending", "P"),
          row("confirmed", "C"),
          row("shipping", "S"),
          row("delivered", "D"),
          row("cancelled", "X"),
        ]}
      />,
    );
    expect(screen.getAllByTestId("step-button")).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Bắt đầu giao đơn C" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Đã giao xong đơn S" })).toBeInTheDocument();
  });

  it("thành công: gửi { from, to } ngay, nút 'Đang chuyển…', rồi tải lại và StatusNotice nhận focus", async () => {
    reply(200, {});
    render(<AdminQueueList tab="confirmed" emptyTitle="Trống" rows={[row("confirmed")]} />);
    const button = screen.getByTestId("step-button");
    fireEvent.click(button);
    expect(button).toBeDisabled();
    expect(button).toHaveTextContent("Đang chuyển…");
    const notice = await screen.findByTestId("status-notice");
    expect(notice).toHaveTextContent(`Đơn ${ID} đã chuyển sang Đang giao`);
    expect(notice).toHaveFocus();
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      from: "confirmed",
      to: "shipping",
    });
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it("shipping -> delivered ghi nhãn 'Đã giao'", async () => {
    reply(200, {});
    render(<AdminQueueList tab="shipping" emptyTitle="Trống" rows={[row("shipping")]} />);
    fireEvent.click(screen.getByTestId("step-button"));
    expect(await screen.findByTestId("status-notice")).toHaveTextContent(
      `Đơn ${ID} đã chuyển sang Đã giao`,
    );
  });

  it("409: ErrorBanner trên đầu danh sách, tải lại; thao tác mới xóa banner/notice cũ, không hiện cùng lúc", async () => {
    reply(409, {
      error: { code: "ORDER_STATUS_CONFLICT", message: "Đơn đã được cập nhật ở nơi khác" },
    });
    render(<AdminQueueList tab="confirmed" emptyTitle="Trống" rows={[row("confirmed")]} />);
    fireEvent.click(screen.getByTestId("step-button"));
    const banner = await screen.findByTestId("conflict-banner");
    expect(banner).toHaveTextContent("Đơn đã được cập nhật ở nơi khác");
    expect(banner).toHaveFocus();
    expect(router.refresh).toHaveBeenCalledOnce();

    reply(200, {});
    fireEvent.click(screen.getByTestId("step-button"));
    await screen.findByTestId("status-notice");
    expect(screen.queryByTestId("conflict-banner")).not.toBeInTheDocument();
  });

  it("401 chuyển tới đăng nhập; 500 và mạng hiện banner, nút bật lại, không lạc quan", async () => {
    reply(401, {});
    render(<AdminQueueList tab="confirmed" emptyTitle="Trống" rows={[row("confirmed")]} />);
    const button = screen.getByTestId("step-button");
    fireEvent.click(button);
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(expect.stringMatching(/^\/admin\/login\?next=/)),
    );
    expect(button).toBeEnabled();

    reply(500, { error: { code: "INTERNAL_ERROR", message: "x" } });
    fireEvent.click(button);
    expect(await screen.findByTestId("conflict-banner")).toHaveTextContent(
      "Đã có lỗi xảy ra, vui lòng thử lại sau",
    );
    expect(button).toBeEnabled();
    expect(router.refresh).not.toHaveBeenCalled();

    fetchMock.mockRejectedValueOnce(new TypeError("offline"));
    fireEvent.click(button);
    await waitFor(() =>
      expect(screen.getByTestId("conflict-banner")).toHaveTextContent("Không kết nối được"),
    );
  });
});

describe("StepButton ở đầu màn chi tiết", () => {
  const setup = (status: QueueRow["status"]) =>
    render(
      <OrderActionsProvider orderId={ID}>
        <DetailStepButton orderId={ID} status={status} />
        <OrderActionError />
      </OrderActionsProvider>,
    );

  it.each(["pending", "delivered", "cancelled"] as const)("đơn %s không có nút", (status) => {
    setup(status);
    expect(screen.queryByTestId("step-button")).not.toBeInTheDocument();
  });

  it.each([
    ["confirmed", "shipping", "confirmed"],
    ["shipping", "delivered", "shipping"],
  ] as const)("%s: thành công chuyển tới tab của trạng thái trước", async (from, notice, tab) => {
    reply(200, {});
    setup(from);
    fireEvent.click(screen.getByTestId("step-button"));
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(`/admin?tab=${tab}&notice=${notice}&order=${ID}`),
    );
  });

  it("409: ErrorBanner và tải lại đơn", async () => {
    reply(409, {
      error: { code: "ORDER_STATUS_CONFLICT", message: "Đơn đã được cập nhật ở nơi khác" },
    });
    setup("confirmed");
    fireEvent.click(screen.getByTestId("step-button"));
    expect(await screen.findByTestId("conflict-banner")).toHaveFocus();
    expect(router.refresh).toHaveBeenCalledOnce();
  });
});
