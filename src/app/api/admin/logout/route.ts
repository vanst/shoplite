import { clearSessionCookie, requireAdminApi } from "@/features/admin/admin-guard";

/** POST /api/admin/logout - đăng xuất quản trị: 204 + xóa cookie phiên. */
export async function POST(request: Request) {
  const ctx = await requireAdminApi(request);
  if (ctx instanceof Response) return ctx;

  return new Response(null, {
    status: 204,
    headers: { "Set-Cookie": clearSessionCookie(request) },
  });
}
