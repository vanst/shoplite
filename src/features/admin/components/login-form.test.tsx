import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderToString } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push, refresh }) }));

import { LOGIN_LOCKED_MESSAGE } from "../admin-messages";
import { LoginForm } from "./login-form";

const errorResponse = (status: number, message: string) =>
  new Response(JSON.stringify({ error: { code: "X", message } }), { status });

function stubFetch(result: Response | Error) {
  const fetchMock = vi.fn(() =>
    result instanceof Error ? Promise.reject(result) : Promise.resolve(result),
  );
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const input = () => screen.getByLabelText("Mật khẩu");
const submit = () =>
  userEvent.click(screen.getByRole("button", { name: /Đăng nhập|Đang đăng nhập/ }));

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockClear();
  refresh.mockClear();
});

describe("<LoginForm />", () => {
  it("khóa nút Đăng nhập khi render trên server, trước khi hydrate", () => {
    const host = document.createElement("div");
    host.innerHTML = renderToString(<LoginForm next="/admin" />);
    expect(host.querySelector('button[type="submit"]')).toBeDisabled();
  });

  it("có input ẩn username và ô mật khẩu đúng autoComplete", () => {
    const { container } = render(<LoginForm next="/admin" />);
    expect(container.querySelector('input[autocomplete="username"]')).toHaveValue("admin");
    expect(input()).toHaveAttribute("autocomplete", "current-password");
    expect(input()).toHaveAttribute("type", "password");
  });

  it("ô trống: báo lỗi field, không gọi API, focus ô", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));
    render(<LoginForm next="/admin" />);
    await submit();

    expect(screen.getByText("Vui lòng nhập mật khẩu")).toBeVisible();
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(input()).toHaveAccessibleDescription("Vui lòng nhập mật khẩu");
    expect(input()).toHaveFocus();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sai mật khẩu: banner không có role, xóa ô và focus ô", async () => {
    stubFetch(errorResponse(401, "Mật khẩu không đúng"));
    render(<LoginForm next="/admin" />);
    await userEvent.type(input(), "sai");
    await submit();

    const banner = await screen.findByTestId("login-error");
    expect(banner).toHaveTextContent("Mật khẩu không đúng");
    expect(banner).not.toHaveAttribute("role");
    expect(input()).toHaveValue("");
    expect(input()).toHaveFocus();
    expect(input()).toHaveAttribute("aria-invalid", "true");
    expect(push).not.toHaveBeenCalled();
  });

  it("đang chờ: nút đổi chữ và bị khóa", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => new Promise(() => {})),
    );
    render(<LoginForm next="/admin" />);
    await userEvent.type(input(), "abc");
    await submit();

    const button = await screen.findByRole("button", { name: "Đang đăng nhập…" });
    expect(button).toBeDisabled();
  });

  it("429: hiện message server, banner nhận focus, nút không khóa, giữ giá trị", async () => {
    stubFetch(errorResponse(429, LOGIN_LOCKED_MESSAGE));
    render(<LoginForm next="/admin" />);
    await userEvent.type(input(), "abc");
    await submit();

    const banner = await screen.findByTestId("login-error");
    expect(banner).toHaveTextContent(LOGIN_LOCKED_MESSAGE);
    await waitFor(() => expect(banner).toHaveFocus());
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
    expect(input()).toHaveValue("abc");
  });

  it("401 có message khác: hiện đúng message của server", async () => {
    stubFetch(errorResponse(401, "Phiên không hợp lệ"));
    render(<LoginForm next="/admin" />);
    await userEvent.type(input(), "abc");
    await submit();

    expect(await screen.findByTestId("login-error")).toHaveTextContent("Phiên không hợp lệ");
  });

  it("401 thân không phải JSON: dùng câu mặc định Mật khẩu không đúng", async () => {
    stubFetch(new Response("<html>", { status: 401 }));
    render(<LoginForm next="/admin" />);
    await userEvent.type(input(), "abc");
    await submit();

    expect(await screen.findByTestId("login-error")).toHaveTextContent("Mật khẩu không đúng");
  });

  it("JSON không có trường error: không báo nhầm mất kết nối", async () => {
    stubFetch(new Response("{}", { status: 401 }));
    render(<LoginForm next="/admin" />);
    await userEvent.type(input(), "abc");
    await submit();

    expect(await screen.findByTestId("login-error")).toHaveTextContent("Mật khẩu không đúng");
  });

  it("429 thân không phải JSON: hiện câu lỗi chung", async () => {
    stubFetch(new Response("<html>", { status: 429 }));
    render(<LoginForm next="/admin" />);
    await userEvent.type(input(), "abc");
    await submit();

    expect(await screen.findByTestId("login-error")).toHaveTextContent(
      "Đã có lỗi xảy ra, vui lòng thử lại sau",
    );
  });

  it("500: hiện câu lỗi chung", async () => {
    stubFetch(errorResponse(500, "chi tiết nội bộ"));
    render(<LoginForm next="/admin" />);
    await userEvent.type(input(), "abc");
    await submit();

    expect(await screen.findByTestId("login-error")).toHaveTextContent(
      "Đã có lỗi xảy ra, vui lòng thử lại sau",
    );
    expect(screen.getByRole("button", { name: "Đăng nhập" })).toBeEnabled();
  });

  it("mạng lỗi: hiện câu không kết nối được, giữ giá trị", async () => {
    stubFetch(new Error("mạng"));
    render(<LoginForm next="/admin" />);
    await userEvent.type(input(), "abc");
    await submit();

    const banner = await screen.findByTestId("login-error");
    expect(banner).toHaveTextContent("Không kết nối được máy chủ, vui lòng thử lại.");
    await waitFor(() => expect(banner).toHaveFocus());
    expect(input()).toHaveValue("abc");
  });

  it("đăng nhập đúng: gửi mật khẩu và chuyển tới next", async () => {
    const fetchMock = stubFetch(new Response(null, { status: 204 }));
    render(<LoginForm next="/admin/orders" />);
    await userEvent.type(input(), "abc");
    await submit();

    await waitFor(() => expect(push).toHaveBeenCalledWith("/admin/orders"));
    expect(refresh).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      "/api/admin/login",
      expect.objectContaining({ method: "POST", body: JSON.stringify({ password: "abc" }) }),
    );
  });

  it("phiên hết hạn: hiện câu thông báo phía trên và focus ô; không hết hạn thì không hiện", () => {
    const { unmount } = render(<LoginForm next="/admin" expired />);
    expect(screen.getByText("Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại")).toBeVisible();
    expect(input()).toHaveFocus();
    unmount();

    render(<LoginForm next="/admin" />);
    expect(screen.queryByText(/hết hạn/)).toBeNull();
  });
});
