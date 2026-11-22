import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { OrderError } from "@/features/orders/order-errors";
import type { Order, OrderStatus } from "@/features/orders/types";
import AdminOrderPage, { dynamic, generateMetadata } from "./page";

const mocks = vi.hoisted(() => ({
  requireAdmin: vi.fn(),
  getOrderForStaff: vi.fn(),
  getRawStockFor: vi.fn(),
  listOrders: vi.fn(),
  ctx: { admin: true },
}));

vi.mock("@/features/admin/admin-guard", () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn() }),
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));
vi.mock("@/features/inventory/server", () => ({
  inventoryService: { getRawStockFor: mocks.getRawStockFor },
}));
vi.mock("@/features/orders/server", () => ({
  orderService: { getOrderForStaff: mocks.getOrderForStaff, listOrders: mocks.listOrders },
}));

const ID = "SL-20261021-ABC123";
const NOW = new Date("2026-10-21T08:00:00.000Z"); // 5 giờ sau createdAt

function order(status: OrderStatus = "pending", extra: Partial<Order> = {}): Order {
  return {
    id: ID,
    status,
    createdAt: "2026-10-21T03:00:00.000Z",
    updatedAt: "2026-10-21T03:00:00.000Z",
    customer: {
      fullName: "Nguyễn Văn An",
      phone: "0987654321",
      email: "an@example.com",
      address: "12 Lê Lợi Quận 1 Hồ Chí Minh",
      note: "Giao giờ hành chính",
    },
    shippingMethod: "express",
    paymentMethod: "bank_transfer",
    items: [
      {
        productId: "p010",
        slug: "cap-usb-c",
        name: "Cáp USB-C",
        image: { emoji: "🔌", from: "#fff", to: "#000" },
        unitPrice: 100_000,
        quantity: 2,
        lineTotal: 200_000,
      },
    ],
    subtotal: 200_000,
    couponCode: "GIAM50K",
    discount: 50_000,
    shippingFee: 60_000,
    total: 210_000,
    ...extra,
  } as Order;
}

const renderPage = async (id = ID) =>
  render(await AdminOrderPage({ params: Promise.resolve({ id }) } as never));

beforeEach(() => {
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(NOW);
  mocks.requireAdmin.mockReset().mockResolvedValue(mocks.ctx);
  mocks.getOrderForStaff.mockReset().mockResolvedValue(order());
  mocks.getRawStockFor.mockReset().mockResolvedValue({ p010: 1 });
  mocks.listOrders.mockReset().mockResolvedValue([]);
});
afterEach(() => vi.useRealTimers());

describe("trang /admin/orders/[id] - truy cập", () => {
  it("force-dynamic; requireAdmin gọi đúng đường dẫn có mã đơn từ URL, trước khi đọc đơn", async () => {
    expect(dynamic).toBe("force-dynamic");
    await renderPage();
    expect(mocks.requireAdmin).toHaveBeenCalledExactlyOnceWith(`/admin/orders/${ID}`);
    expect(mocks.requireAdmin.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.getOrderForStaff.mock.invocationCallOrder[0],
    );
  });

  it("chưa đăng nhập (guard chuyển hướng) hoặc chưa cấu hình (guard 404): không đọc đơn", async () => {
    for (const error of [new Error("NEXT_REDIRECT"), new Error("NEXT_NOT_FOUND")]) {
      mocks.requireAdmin.mockRejectedValueOnce(error);
      await expect(renderPage()).rejects.toThrow(error.message);
    }
    expect(mocks.getOrderForStaff).not.toHaveBeenCalled();
  });

  it("lấy đơn bằng getOrderForStaff(ctx, canonicalOrderId(id)): mã thường/khoảng trắng vẫn khớp", async () => {
    await renderPage("%20sl-20261021-abc123%20");
    expect(mocks.getOrderForStaff).toHaveBeenCalledExactlyOnceWith(mocks.ctx, ID);
  });

  it("mã không tồn tại hoặc quá 32 ký tự: not-found (404)", async () => {
    mocks.getOrderForStaff.mockRejectedValueOnce(new OrderError("ORDER_NOT_FOUND", "x"));
    await expect(renderPage("SL-KHONG-CO")).rejects.toThrow("NEXT_NOT_FOUND");
    await expect(renderPage("A".repeat(33))).rejects.toThrow("NEXT_NOT_FOUND");
  });

  it("lỗi khác được ném lại, không thành 404", async () => {
    mocks.getOrderForStaff.mockRejectedValueOnce(new Error("hỏng file"));
    await expect(renderPage()).rejects.toThrow("hỏng file");
  });

  it("title lấy từ URL, không đọc đơn, không chứa PII", async () => {
    expect(await generateMetadata({ params: Promise.resolve({ id: ID }) } as never)).toEqual({
      title: `Đơn hàng ${ID} · Quản trị`,
    });
    expect(mocks.getOrderForStaff).not.toHaveBeenCalled();
  });
});

describe("trang /admin/orders/[id] - nội dung", () => {
  it("đơn đủ trường: H1 + badge, đặt lúc + tuổi đơn, món, tiền, người nhận đủ PII, giao hàng & thanh toán", async () => {
    await renderPage();
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(`Đơn hàng ${ID}`);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("Chờ xác nhận");
    expect(screen.getByText(/Đặt lúc/)).toHaveTextContent("· Quá hạn, Chờ 5 giờ");
    expect(screen.getByTestId("overdue-age")).toHaveClass("font-semibold", "text-rose-700");

    expect(screen.getByText("Cáp USB-C")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Cáp USB-C" })).toBeNull();
    expect(screen.getByTestId("order-discount")).toHaveTextContent("GIAM50K");

    const recipient = within(screen.getByTestId("admin-recipient"));
    expect(recipient.getByText("Nguyễn Văn An")).toBeInTheDocument();
    expect(recipient.getByText("an@example.com")).toBeInTheDocument();
    expect(recipient.getByText("12 Lê Lợi Quận 1 Hồ Chí Minh")).toBeInTheDocument();
    expect(recipient.getByText("Giao giờ hành chính").tagName).toBe("EM");
    expect(recipient.getByRole("link", { name: "0987654321" })).toHaveAttribute(
      "href",
      "tel:0987654321",
    );
    expect(screen.getByText("Giao hàng & thanh toán")).toBeInTheDocument();
    expect(screen.getByText(/Chuyển khoản ngân hàng/)).toBeInTheDocument();
  });

  it("đơn cũ thiếu couponCode/discount/email/note: không lỗi, giảm giá 0đ không hiện dòng giảm", async () => {
    const legacy = order("pending");
    delete (legacy as Partial<Order>).couponCode;
    delete (legacy as Partial<Order>).discount;
    delete (legacy.customer as Partial<Order["customer"]>).email;
    delete (legacy.customer as Partial<Order["customer"]>).note;
    mocks.getOrderForStaff.mockResolvedValue(legacy);
    await renderPage();
    expect(screen.queryByTestId("order-discount")).toBeNull();
    expect(screen.queryByText("Email")).toBeNull();
    expect(screen.queryByText("Ghi chú")).toBeNull();
  });

  it.each<[OrderStatus, string]>([
    ["pending", "pending"],
    ["confirmed", "confirmed"],
    ["shipping", "shipping"],
    ["delivered", "done"],
    ["cancelled", "done"],
  ])("đơn %s: BackLink 'Hàng việc' về /admin?tab=%s", async (status, tab) => {
    mocks.getOrderForStaff.mockResolvedValue(order(status));
    await renderPage();
    expect(screen.getByRole("link", { name: "Hàng việc" })).toHaveAttribute(
      "href",
      `/admin?tab=${tab}`,
    );
  });

  it.each<[OrderStatus, string | null]>([
    ["confirmed", "Bắt đầu giao"],
    ["shipping", "Đã giao xong"],
    ["delivered", null],
    ["cancelled", null],
  ])("đơn %s: chỉ có StepButton đúng nhãn (nếu có), không tuổi đơn", async (status, label) => {
    mocks.getOrderForStaff.mockResolvedValue(order(status));
    await renderPage();
    // Đơn confirmed còn nút Báo thiếu hàng ở từng dòng món (Story 5.7)
    const names = screen
      .queryAllByRole("button")
      .map((b) => b.textContent)
      .filter((t) => t !== "Báo thiếu hàng");
    expect(names).toEqual(label ? [`${label} đơn ${ID}`] : []);
    expect(screen.queryAllByTestId("shortage-report-button")).toHaveLength(
      status === "confirmed" ? 1 : 0,
    );
    expect(screen.getByText(/Đặt lúc/)).not.toHaveTextContent("Chờ ");
  });
});

describe("trang /admin/orders/[id] - quá hạn (Story 4.8)", () => {
  it("đúng 4 giờ chưa đỏ; 4 giờ + 1ms đỏ; không pending không đỏ", async () => {
    vi.setSystemTime(new Date("2026-10-21T07:00:00.000Z"));
    await renderPage();
    expect(screen.queryByTestId("overdue-age")).toBeNull();
    expect(screen.getByText(/Đặt lúc/)).toHaveTextContent("· Chờ 4 giờ");
    cleanup();
    vi.setSystemTime(new Date("2026-10-21T07:00:00.001Z"));
    await renderPage();
    expect(screen.getByTestId("overdue-age")).toHaveTextContent("Quá hạn, Chờ 4 giờ");
    cleanup();
    mocks.getOrderForStaff.mockResolvedValue(order("confirmed"));
    await renderPage();
    expect(screen.queryByTestId("overdue-age")).toBeNull();
  });
});

describe("trang /admin/orders/[id] - bảng tồn kho (Story 4.5)", () => {
  it("đơn pending: StockReviewTable thay danh sách món, đánh dấu khi đặt 2 > tồn 1", async () => {
    await renderPage();
    expect(mocks.getRawStockFor).toHaveBeenCalledExactlyOnceWith(["p010"]);
    expect(screen.getByRole("table", { name: "Tồn kho các món" })).toBeInTheDocument();
    expect(screen.getByTestId("stock-short")).toHaveTextContent("Không đủ hàng");
    expect(screen.getByTestId("stock-current")).toHaveTextContent("1");
    expect(screen.getByTestId("confirm-order-button")).toHaveAttribute("aria-disabled", "true");
  });

  it("cột Đang chờ chỉ tính số lượng đơn pending khác, không đổi trạng thái khóa nút (Story 4.9)", async () => {
    const other = (id: string, status: OrderStatus, quantity: number) => ({
      ...order(status),
      id,
      items: [{ ...order().items[0], quantity }],
    });
    mocks.getRawStockFor.mockResolvedValue({ p010: 5 });
    mocks.listOrders.mockResolvedValue([
      order(),
      other("B", "pending", 2),
      other("C", "pending", 1),
      other("D", "confirmed", 9),
      other("E", "cancelled", 9),
    ]);
    await renderPage();
    expect(screen.getByTestId("stock-pending")).toHaveTextContent("3");
    expect(screen.getByRole("button", { name: "Xác nhận đơn" })).not.toHaveAttribute(
      "aria-disabled",
    );
  });

  it("đơn không pending: không có cột Đang chờ và không quét danh sách đơn", async () => {
    mocks.getOrderForStaff.mockResolvedValue(order("confirmed"));
    await renderPage();
    expect(screen.queryByTestId("stock-pending")).toBeNull();
    expect(mocks.listOrders).not.toHaveBeenCalled();
  });

  it("đơn pending đủ hàng: nút Xác nhận đơn dùng được", async () => {
    mocks.getRawStockFor.mockResolvedValue({ p010: 5 });
    await renderPage();
    const button = screen.getByRole("button", { name: "Xác nhận đơn" });
    expect(button).not.toHaveAttribute("aria-disabled");
  });

  it.each<OrderStatus>(["confirmed", "shipping", "delivered", "cancelled"])(
    "đơn %s: không bảng, không đọc tồn, vẫn có danh sách món",
    async (status) => {
      mocks.getOrderForStaff.mockResolvedValue(order(status));
      await renderPage();
      expect(screen.queryByRole("table")).toBeNull();
      expect(screen.queryByTestId("confirm-order-button")).toBeNull();
      expect(mocks.getRawStockFor).not.toHaveBeenCalled();
      expect(screen.getByRole("img", { name: "Cáp USB-C" })).toBeInTheDocument();
    },
  );
});
