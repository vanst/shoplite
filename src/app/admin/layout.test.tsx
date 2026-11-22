// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { assertAdminEnabled, getAdminSession } = vi.hoisted(() => ({
  assertAdminEnabled: vi.fn(),
  getAdminSession: vi.fn(),
}));
vi.mock("@/features/admin/admin-guard", () => ({ assertAdminEnabled, getAdminSession }));

import AdminLayout from "./layout";

/** Props của phần tử AdminHeader (con đầu của fragment) trong cây trả về. */
const headerProps = async () => {
  const tree = await AdminLayout({ children: null } as Parameters<typeof AdminLayout>[0]);
  const [header] = tree.props.children as { props: { loggedIn: boolean } }[];
  return header.props;
};

beforeEach(() => vi.clearAllMocks());

describe("AdminLayout", () => {
  it("kiểm tra đã cấu hình trước khi dựng khung", async () => {
    getAdminSession.mockResolvedValue("none");
    await headerProps();
    expect(assertAdminEnabled).toHaveBeenCalledOnce();
  });

  it.each([
    ["valid", true],
    ["invalid", false],
    ["none", false],
  ])("phiên %s thì loggedIn là %s", async (session, expected) => {
    getAdminSession.mockResolvedValue(session);
    expect(await headerProps()).toEqual({ loggedIn: expected });
  });
});
