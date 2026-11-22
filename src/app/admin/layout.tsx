import { AdminSearchGate } from "@/features/admin/components/admin-search-gate";
import { AdminHeader } from "@/features/admin/components/admin-header";
import { assertAdminEnabled, getAdminSession } from "@/features/admin/admin-guard";

// Không phải chốt chặn: chỉ để chưa cấu hình thì không dựng AdminHeader; guard thật nằm ở từng page.
export default async function AdminLayout({ children }: LayoutProps<"/admin">) {
  assertAdminEnabled();
  const loggedIn = (await getAdminSession()) === "valid";

  return (
    <>
      <AdminHeader loggedIn={loggedIn} />
      <main className="flex-1">
        <AdminSearchGate>{children}</AdminSearchGate>
      </main>
    </>
  );
}
