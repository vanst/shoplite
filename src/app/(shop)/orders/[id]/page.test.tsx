import { render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GRANT_COOKIE_NAME, issueGrantCookie } from "@/features/order-access/order-grant";
import type { MaskedOrder } from "@/features/order-access/mask-order";
import { OrderError } from "@/features/orders/order-errors";
import OrderDetailPage, { generateMetadata } from "./page";

const mocks = vi.hoisted(() => ({
  token: undefined as string | undefined,
  getMaskedOrder: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (mocks.token ? { name, value: mocks.token } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
  useRouter: () => ({ refresh: vi.fn() }),
}));
vi.mock("@/features/orders/server", () => ({
  orderService: { getMaskedOrder: mocks.getMaskedOrder },
}));

const ID = "SL-20261021-ABC123";

function grantToken(id: string, via: "placed" | "lookup") {
  const setCookie = issueGrantCookie(new Request("http://localhost/"), id, via);
  return setCookie.split(";")[0].slice(GRANT_COOKIE_NAME.length + 1);
}

function maskedOrder(status: MaskedOrder["status"] = "pending"): MaskedOrder {
  return {
    id: ID,
    status,
    items: [
      {
        productId: "p010",
        slug: "cap-usb-c",
        name: "Cáp USB-C",
        image: "",
        unitPrice: 100_000,
        quantity: 1,
        lineTotal: 100_000,
      },
    ],
    subtotal: 100_000,
    shippingFee: 30_000,
    discount: 0,
    total: 130_000,
    shippingMethod: "standard",
    paymentMethod: "cod",
    createdAt: "2026-10-21T03:00:00.000Z",
    recipient: { name: "Test", phone: "•••••• 5678" },
    timeline: [{ label: "Đặt hàng", at: "2026-10-21T03:00:00.000Z" }],
  } as unknown as MaskedOrder;
}

const renderPage = async (id = ID) =>
  render(await OrderDetailPage({ params: Promise.resolve({ id }) } as never));

describe("trang /orders/[id]", () => {
  beforeEach(() => {
    mocks.token = undefined;
    mocks.getMaskedOrder.mockReset().mockResolvedValue(maskedOrder());
  });
  afterEach(() => vi.useRealTimers());

  it("grant placed + pending: banner, thẻ người nhận che, BackLink mới, nút hủy; URL viết thường vẫn khớp", async () => {
    mocks.token = grantToken(ID, "placed");
    await renderPage(ID.toLowerCase());
    expect(screen.getByText("Đặt hàng thành công!")).toBeInTheDocument();
    expect(screen.getByTestId("masked-recipient")).toHaveTextContent("•••••• 5678");
    expect(screen.getByRole("link", { name: "Tra cứu đơn khác" })).toHaveAttribute(
      "href",
      "/orders",
    );
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(`Đơn hàng ${ID}`);
    expect(screen.getByRole("button", { name: "Hủy đơn hàng" })).toBeInTheDocument();
  });

  it("grant lookup: không banner", async () => {
    mocks.token = grantToken(ID, "lookup");
    await renderPage();
    expect(screen.queryByText("Đặt hàng thành công!")).toBeNull();
  });

  it("đơn không còn pending: không banner, không nút hủy", async () => {
    mocks.token = grantToken(ID, "placed");
    mocks.getMaskedOrder.mockResolvedValue(maskedOrder("confirmed"));
    await renderPage();
    expect(screen.queryByText("Đặt hàng thành công!")).toBeNull();
    expect(screen.queryByRole("button", { name: "Hủy đơn hàng" })).toBeNull();
  });

  it("đơn bị từ chối: RejectionNotice nằm sau phần đầu, trước thẻ Hành trình và Sản phẩm; có link hết hàng", async () => {
    mocks.token = grantToken(ID, "lookup");
    mocks.getMaskedOrder.mockResolvedValue({
      ...maskedOrder("cancelled"),
      cancelledBy: "staff",
      cancelReasonLabel: "Hết hàng",
      categoryHref: "/products?category=phu-kien",
      timeline: [
        { label: "Đặt hàng", at: "2026-10-21T03:00:00.000Z" },
        { label: "Đã hủy", at: "2026-10-21T04:00:00.000Z" },
      ],
    });
    await renderPage();
    const notice = screen.getByTestId("rejection-notice");
    expect(notice).toHaveTextContent("Shop đã từ chối đơn, lý do: Hết hàng");
    const timeline = screen.getByRole("heading", { name: "Hành trình đơn hàng" });
    const products = screen.getByRole("heading", { name: "Sản phẩm" });
    expect(
      notice.compareDocumentPosition(timeline) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(
      timeline.compareDocumentPosition(products) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(screen.getAllByTestId("timeline-entry")[0]).toHaveTextContent("Đã hủy");
    expect(screen.getByRole("link", { name: "Xem sản phẩm cùng danh mục" })).toBeInTheDocument();
  });

  it("khách tự hủy: 'Bạn đã hủy đơn'; đơn hủy cũ thiếu cancelledBy: không có notice", async () => {
    mocks.token = grantToken(ID, "lookup");
    mocks.getMaskedOrder.mockResolvedValue({
      ...maskedOrder("cancelled"),
      cancelledBy: "customer",
    });
    await renderPage();
    expect(screen.getByTestId("rejection-notice")).toHaveTextContent("Bạn đã hủy đơn");
    document.body.innerHTML = "";
    mocks.getMaskedOrder.mockResolvedValue(maskedOrder("cancelled"));
    await renderPage();
    expect(screen.queryByTestId("rejection-notice")).toBeNull();
  });

  it("title lấy từ URL, không truy vấn dữ liệu", async () => {
    expect(await generateMetadata({ params: Promise.resolve({ id: ID }) } as never)).toEqual({
      title: `Đơn hàng ${ID}`,
    });
    expect(mocks.getMaskedOrder).not.toHaveBeenCalled();
  });
});
