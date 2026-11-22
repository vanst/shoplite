// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { assertAdminEnabled, requireAdmin, getAdminSession } = vi.hoisted(() => ({
  assertAdminEnabled: vi.fn(),
  requireAdmin: vi.fn(),
  getAdminSession: vi.fn(),
}));
vi.mock("@/features/admin/admin-guard", () => ({
  assertAdminEnabled,
  requireAdmin,
  getAdminSession,
}));
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Error(`NEXT_REDIRECT:${url}`);
  },
}));

import AdminLoginPage, { generateMetadata } from "./page";

const search = (params: Record<string, string | string[]>) =>
  ({ searchParams: Promise.resolve(params) }) as Parameters<typeof AdminLoginPage>[0];

/** Props của phần tử LoginForm trong cây trả về. */
const formProps = async (params: Record<string, string | string[]>) => {
  const page = await AdminLoginPage(search(params));
  const form = (page.props.children as { props: { next: string; expired: boolean } }[])[1];
  return form.props;
};

beforeEach(() => {
  vi.clearAllMocks();
  getAdminSession.mockResolvedValue("none");
});

describe("trang /admin/login", () => {
  it("chỉ kiểm tra đã cấu hình, không yêu cầu đăng nhập", async () => {
    await AdminLoginPage(search({}));
    expect(assertAdminEnabled).toHaveBeenCalledOnce();
    expect(requireAdmin).not.toHaveBeenCalled();
  });

  it("đã đăng nhập thì chuyển /admin", async () => {
    getAdminSession.mockResolvedValue("valid");
    await expect(AdminLoginPage(search({ next: "/admin/x" }))).rejects.toThrow(
      "NEXT_REDIRECT:/admin",
    );
  });

  it("làm sạch next và chỉ báo hết hạn khi có next cùng cookie không hợp lệ", async () => {
    getAdminSession.mockResolvedValue("invalid");
    expect(await formProps({ next: "/admin/orders" })).toEqual({
      next: "/admin/orders",
      expired: true,
    });
    expect(await formProps({ next: "//evil.com" })).toEqual({ next: "/admin", expired: true });
    expect(await formProps({})).toEqual({ next: "/admin", expired: false });
    getAdminSession.mockResolvedValue("none");
    expect(await formProps({ next: "/admin/orders" })).toEqual({
      next: "/admin/orders",
      expired: false,
    });
  });

  it("generateMetadata kiểm tra cấu hình rồi trả tiêu đề", async () => {
    await expect(generateMetadata()).resolves.toEqual({ title: "Đăng nhập quản trị" });
    expect(assertAdminEnabled).toHaveBeenCalledOnce();
  });
});
