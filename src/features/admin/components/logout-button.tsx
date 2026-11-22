"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { adminSearchStore } from "../admin-search-store";

/** Đăng xuất không hỏi lại; kể cả khi gọi API lỗi vẫn chuyển về trang đăng nhập. */
export function LogoutButton() {
  const router = useRouter();

  async function logout() {
    try {
      await fetch("/api/admin/logout", { method: "POST" });
    } catch {
      // Bỏ qua: phiên hỏng hoặc mất mạng thì trang đăng nhập vẫn là nơi đúng để về
    }
    adminSearchStore.clear(); // kết quả tìm SĐT không được sống sau đăng xuất
    router.push("/admin/login");
    router.refresh(); // layout dùng chung phải đọc lại phiên để ẩn nút Đăng xuất
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      className="focus-visible:outline-indigo-600!"
      onClick={logout}
      data-testid="admin-logout"
    >
      Đăng xuất
    </Button>
  );
}
