"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/features/orders/types";
import {
  adminSearchStore,
  focusSearchInput,
  runSearch,
  useAdminSearch,
  type AdminSearchState,
} from "../admin-search-store";
import { noticeMessage, type NoticeCode } from "../admin-notice";
import { useStaffTransition } from "../use-staff-transition";
import { ErrorBanner, StatusNotice } from "./admin-feedback";
import { AdminOrderRow } from "./admin-order-row";

const SEARCH_TITLE = "Tìm theo SĐT · Quản trị";

/** Khi có kết quả tìm thì thay nội dung trang bằng kết quả; không thì hiện trang như thường. */
export function AdminSearchGate({ children }: { children: ReactNode }) {
  const search = useAdminSearch();
  return search ? <AdminSearchResults search={search} /> : children;
}

function AdminSearchResults({ search }: { search: AdminSearchState }) {
  const router = useRouter();
  const { submit } = useStaffTransition();
  const [notice, setNotice] = useState<string | null>(null);
  const [stepError, setStepError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const { phone, rows } = search;
  const error = stepError ?? search.error;

  useEffect(() => heading.current?.focus(), [phone]);
  useEffect(() => {
    const previous = document.title;
    document.title = SEARCH_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);

  async function step(id: string, from: OrderStatus, to: OrderStatus, code: NoticeCode) {
    setNotice(null);
    setStepError(null);
    setBusyId(id);
    const outcome = await submit(id, from, to);
    setBusyId(null);
    if (!outcome) return;
    if (outcome.ok) {
      setNotice(noticeMessage(code, id) ?? `Đơn ${id} đã chuyển sang ${ORDER_STATUS_LABELS[to]}`);
    } else {
      setStepError(outcome.message);
    }
    if ((await runSearch(phone)) === "unauthorized") {
      adminSearchStore.clear();
      const here = `${window.location.pathname}${window.location.search}`;
      router.push(`/admin/login?next=${encodeURIComponent(here)}`);
      return;
    }
    router.refresh(); // Hàng việc phía sau cũng phải đọc lại
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-8">
      <div className="flex flex-wrap items-center gap-2">
        <h1 ref={heading} tabIndex={-1} className="text-lg font-semibold outline-none">
          Kết quả cho {phone}
        </h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            adminSearchStore.clear();
            focusSearchInput();
          }}
        >
          Xóa tìm kiếm
        </Button>
      </div>
      {error ? <ErrorBanner message={error} /> : notice && <StatusNotice message={notice} />}
      {rows &&
        (rows.length === 0 ? (
          <EmptyState emoji="🔍" title="Không có đơn nào khớp số điện thoại này" />
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <AdminOrderRow
                key={row.id}
                row={row}
                stepPending={busyId === row.id}
                onStep={(from, to, code) => void step(row.id, from, to, code)}
              />
            ))}
          </ul>
        ))}
    </div>
  );
}
