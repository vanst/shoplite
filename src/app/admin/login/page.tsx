import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { assertAdminEnabled, getAdminSession } from "@/features/admin/admin-guard";
import { LoginForm } from "@/features/admin/components/login-form";
import { sanitizeNext } from "@/features/admin/sanitize-next";

export const dynamic = "force-dynamic";

// Gọi guard trong metadata để chưa cấu hình thì tiêu đề không lộ ra trước notFound()
export async function generateMetadata(): Promise<Metadata> {
  assertAdminEnabled();
  return { title: "Đăng nhập quản trị" };
}

export default async function AdminLoginPage({ searchParams }: PageProps<"/admin/login">) {
  assertAdminEnabled();
  const session = await getAdminSession();
  if (session === "valid") redirect("/admin");

  const { next } = await searchParams;
  const rawNext = typeof next === "string" ? next : undefined;

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Đăng nhập quản trị</h1>
      <LoginForm
        next={sanitizeNext(rawNext)}
        expired={rawNext !== undefined && session === "invalid"}
      />
    </div>
  );
}
