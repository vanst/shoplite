import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const router = vi.hoisted(() => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }));
vi.mock("next/navigation", () => ({
  useRouter: () => router,
  usePathname: () => "/admin",
}));

import { adminSearchStore } from "../admin-search-store";
import type { QueueRow } from "../queue-rules";
import { AdminPhoneSearch } from "./admin-phone-search";
import { AdminSearchGate } from "./admin-search-gate";

const row = (over: Partial<QueueRow>): QueueRow => ({
  id: "SL-20261021-AAAAAA",
  status: "pending",
  createdAt: "2026-10-21T03:00:00.000Z",
  customerName: "Lan",
  itemCount: 1,
  total: 100_000,
  overdue: false,
  ...over,
});

const rows = [
  row({ ageLabel: "Chờ 5 giờ", overdue: true }),
  row({ id: "SL-2", status: "confirmed" }),
  row({ id: "SL-3", status: "cancelled", cancelLabel: "Từ chối · Hết hàng" }),
  row({ id: "SL-4", status: "cancelled", cancelLabel: "Khách tự hủy" }),
];

const respond = (status: number, body: unknown = {}) =>
  vi.fn().mockResolvedValue(new Response(JSON.stringify(body), { status }));

function setup() {
  return render(
    <>
      <AdminPhoneSearch />
      <AdminSearchGate>
        <p>Nội dung tab</p>
      </AdminSearchGate>
    </>,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  act(() => adminSearchStore.clear());
});
afterEach(() => vi.unstubAllGlobals());

describe("tìm đơn theo SĐT trong admin", () => {
  it("ô tìm có nhãn, placeholder, không nút submit", () => {
    setup();
    expect(screen.getByRole("search")).toBeInTheDocument();
    const input = screen.getByLabelText("Tìm đơn theo số điện thoại");
    expect(input).toHaveAttribute("placeholder", "Tìm theo SĐT");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("Enter gửi POST với SĐT trong body, hiện kết quả với nhãn hủy, StepButton, tiêu đề không chứa SĐT", async () => {
    const fetchMock = respond(200, { rows });
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await userEvent.type(screen.getByRole("searchbox"), "0912345678{Enter}");
    const heading = await screen.findByRole("heading", { name: "Kết quả cho 0912345678" });
    expect(heading).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/orders/search",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ phone: "0912345678" }) }),
    );
    expect(document.title).toBe("Tìm theo SĐT · Quản trị");
    expect(screen.queryByText("Nội dung tab")).toBeNull();
    expect(screen.getAllByTestId("admin-order-row")).toHaveLength(4);
    expect(screen.getByText(/Chờ 5 giờ/)).toBeInTheDocument();
    expect(screen.getByText(/Từ chối · Hết hàng/)).toBeInTheDocument();
    expect(screen.getByText(/Khách tự hủy/)).toBeInTheDocument();
    expect(screen.getAllByTestId("step-button")).toHaveLength(1);
    expect(localStorage.length + sessionStorage.length).toBe(0);
  });

  it("không có kết quả: EmptyState, không ErrorBanner", async () => {
    vi.stubGlobal("fetch", respond(200, { rows: [] }));
    setup();
    await userEvent.type(screen.getByRole("searchbox"), "123{Enter}");
    expect(await screen.findByText("Không có đơn nào khớp số điện thoại này")).toBeInTheDocument();
    expect(screen.queryByTestId("conflict-banner")).toBeNull();
  });

  it("Xóa tìm kiếm quay về nội dung tab và focus ô tìm", async () => {
    vi.stubGlobal("fetch", respond(200, { rows }));
    setup();
    await userEvent.type(screen.getByRole("searchbox"), "0912345678{Enter}");
    await userEvent.click(await screen.findByRole("button", { name: "Xóa tìm kiếm" }));
    expect(screen.getByText("Nội dung tab")).toBeInTheDocument();
    expect(screen.getByRole("searchbox")).toHaveFocus();
  });

  it("gửi ô rỗng khi đang có kết quả: quay về tab", async () => {
    vi.stubGlobal("fetch", respond(200, { rows }));
    setup();
    const input = screen.getByRole("searchbox");
    await userEvent.type(input, "0912345678{Enter}");
    await screen.findByRole("heading", { name: /Kết quả/ });
    await userEvent.clear(input);
    await userEvent.type(input, "{Enter}");
    expect(screen.getByText("Nội dung tab")).toBeInTheDocument();
  });

  it("500 hoặc mất mạng: ErrorBanner, ô tìm giữ nội dung", async () => {
    vi.stubGlobal("fetch", respond(500));
    setup();
    await userEvent.type(screen.getByRole("searchbox"), "0912345678{Enter}");
    expect(await screen.findByTestId("conflict-banner")).toHaveTextContent(
      "Đã có lỗi xảy ra, vui lòng thử lại sau",
    );
    expect(screen.getByRole("searchbox")).toHaveValue("0912345678");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    await userEvent.type(screen.getByRole("searchbox"), "{Enter}");
    await waitFor(() =>
      expect(screen.getByTestId("conflict-banner")).toHaveTextContent("Không kết nối được máy chủ"),
    );
  });

  it("401: chuyển tới đăng nhập kèm next", async () => {
    vi.stubGlobal("fetch", respond(401));
    setup();
    await userEvent.type(screen.getByRole("searchbox"), "0912345678{Enter}");
    await waitFor(() =>
      expect(router.push).toHaveBeenCalledWith(expect.stringContaining("/admin/login?next=")),
    );
    expect(screen.getByText("Nội dung tab")).toBeInTheDocument();
  });

  it("StepButton thành công: tìm lại cùng SĐT, ở lại kết quả với StatusNotice", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ rows }), { status: 200 }))
      .mockResolvedValueOnce(new Response("{}", { status: 200 })) // PATCH
      .mockResolvedValueOnce(new Response(JSON.stringify({ rows }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await userEvent.type(screen.getByRole("searchbox"), "0912345678{Enter}");
    await userEvent.click(await screen.findByTestId("step-button"));
    const notice = await screen.findByTestId("status-notice");
    expect(notice).toHaveFocus();
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(screen.getByRole("heading", { name: "Kết quả cho 0912345678" })).toBeInTheDocument();
  });

  it("StepButton 409: ErrorBanner rồi tìm lại", async () => {
    const conflict = {
      error: { code: "ORDER_STATUS_CONFLICT", message: "Đơn đã được cập nhật ở nơi khác" },
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ rows }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify(conflict), { status: 409 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ rows }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    setup();
    await userEvent.type(screen.getByRole("searchbox"), "0912345678{Enter}");
    await userEvent.click(await screen.findByTestId("step-button"));
    expect(await screen.findByTestId("conflict-banner")).toHaveTextContent(
      "Đơn đã được cập nhật ở nơi khác",
    );
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});
