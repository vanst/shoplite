"use client";

import { Search } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { adminSearchStore, registerSearchInput, runSearch } from "../admin-search-store";

/** Ô tìm đơn theo SĐT trên thanh quản trị: Enter gửi POST, SĐT không vào URL/title/storage. */
export function AdminPhoneSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [value, setValue] = useState("");

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const phone = value.trim();
    if (!phone) {
      adminSearchStore.clear();
      return;
    }
    if ((await runSearch(phone)) === "unauthorized") {
      adminSearchStore.clear();
      const here = `${window.location.pathname}${window.location.search}`;
      router.push(`/admin/login?next=${encodeURIComponent(here)}`);
      return;
    }
    if (pathname !== "/admin") router.push("/admin");
  }

  return (
    <form
      role="search"
      onSubmit={onSubmit}
      className="relative order-last w-full sm:order-none sm:max-w-sm sm:flex-1"
    >
      <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
      <input
        ref={registerSearchInput}
        type="search"
        autoComplete="off"
        data-testid="admin-phone-search"
        aria-label="Tìm đơn theo số điện thoại"
        placeholder="Tìm theo SĐT"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="h-10 w-full rounded-xl border border-slate-300 bg-white pr-3 pl-9 text-sm focus-visible:outline-2 focus-visible:outline-indigo-600"
      />
    </form>
  );
}
