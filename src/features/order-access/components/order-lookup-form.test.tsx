import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { LOOKUP_LOCKED_MESSAGE, LOOKUP_NOT_FOUND_MESSAGE } from "../lookup-messages";
import { OrderLookupForm } from "./order-lookup-form";

const errorResponse = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { code: "X", message } }), { status });

function stubFetch(result: Response | Error) {
  const fetchMock = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const orderInput = () => screen.getByLabelText("Mã đơn");
const verificationInput = () => screen.getByLabelText("4 số cuối số điện thoại");
const submit = () => userEvent.click(screen.getByRole("button", { name: /Tra cứu|Đang tra cứu/ }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

describe("<OrderLookupForm />", () => {
  it("báo lỗi từng ô, không gửi request và focus ô lỗi đầu tiên", async () => {
    const fetchMock = stubFetch(new Response("{}"));
    render(<OrderLookupForm />);
    await submit();
    expect(screen.getByText("Vui lòng nhập mã đơn")).toBeInTheDocument();
    expect(screen.getByText("Vui lòng nhập 4 số cuối số điện thoại")).toBeInTheDocument();
    expect(orderInput()).toHaveAttribute("aria-invalid", "true");
    expect(orderInput()).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("báo 'Nhập đủ 4 chữ số' khi ô xác minh chưa đủ", async () => {
    stubFetch(new Response("{}"));
    render(<OrderLookupForm initialOrderId="SL-20260101-ABCDEF" />);
    await userEvent.type(verificationInput(), "12");
    await submit();
    expect(screen.getByText("Nhập đủ 4 chữ số")).toBeInTheDocument();
    expect(verificationInput()).toHaveFocus();
  });

  it("tự viết hoa, bỏ khoảng trắng mã đơn; dán chuỗi dài giữ 4 chữ số cuối", async () => {
    render(<OrderLookupForm />);
    await userEvent.type(orderInput(), "sl- 2026");
    expect(orderInput()).toHaveValue("SL-2026");
    await userEvent.click(verificationInput());
    await userEvent.paste("0912 345 678");
    expect(verificationInput()).toHaveValue("5678");
  });

  it("tra cứu đúng thì POST JSON và chuyển tới trang đơn", async () => {
    const fetchMock = stubFetch(
      new Response(JSON.stringify({ id: "SL-20260101-ABCDEF" }), { status: 200 }),
    );
    render(<OrderLookupForm initialOrderId="SL-20260101-ABCDEF" />);
    await userEvent.type(verificationInput(), "5678");
    await submit();
    await waitFor(() => expect(push).toHaveBeenCalledWith("/orders/SL-20260101-ABCDEF"));
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/orders/lookup",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ orderId: "SL-20260101-ABCDEF", verification: "5678" }),
      }),
    );
    expect(refresh).toHaveBeenCalled();
  });

  it.each([
    [404, LOOKUP_NOT_FOUND_MESSAGE],
    [429, LOOKUP_LOCKED_MESSAGE],
  ])(
    "lỗi %i hiện đúng message server, nhận focus, giữ giá trị và không khóa nút",
    async (status, message) => {
      stubFetch(errorResponse(status, message));
      render(<OrderLookupForm initialOrderId="SL-1" />);
      await userEvent.type(verificationInput(), "1234");
      await submit();
      const banner = await screen.findByTestId("lookup-error");
      expect(banner).toHaveTextContent(message);
      expect(banner).toHaveFocus();
      expect(banner).not.toHaveAttribute("role");
      expect(orderInput()).toHaveValue("SL-1");
      expect(verificationInput()).toHaveValue("1234");
      expect(screen.getByRole("button", { name: "Tra cứu" })).toBeEnabled();
    },
  );

  it("500 và mất mạng hiện câu cố định", async () => {
    stubFetch(errorResponse(500, "raw"));
    render(<OrderLookupForm initialOrderId="SL-1" />);
    await userEvent.type(verificationInput(), "1234");
    await submit();
    expect(await screen.findByTestId("lookup-error")).toHaveTextContent(
      "Đã có lỗi xảy ra, vui lòng thử lại sau",
    );
    stubFetch(new Error("offline"));
    await submit();
    await waitFor(() =>
      expect(screen.getByTestId("lookup-error")).toHaveTextContent(
        "Không kết nối được máy chủ, vui lòng thử lại.",
      ),
    );
  });
});
