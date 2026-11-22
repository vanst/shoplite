"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { EmptyState } from "@/components/ui/empty-state";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/features/orders/types";
import { noticeMessage, type NoticeCode } from "../admin-notice";
import type { AdminTab, QueueRow } from "../queue-rules";
import { useStaffTransition } from "../use-staff-transition";
import { ErrorBanner, StatusNotice } from "./admin-feedback";
import { AdminOrderRow } from "./admin-order-row";

interface AdminQueueListProps {
  tab: AdminTab;
  rows: QueueRow[];
  emptyTitle: string;
  /** Câu StatusNotice từ `?notice=` (đã kiểm ở server); hiện một lần rồi gỡ khỏi URL. */
  urlNotice?: string;
}

/** Danh sách Hàng việc kèm StatusNotice/ErrorBanner: không bao giờ hiện cùng lúc (ErrorBanner thắng). */
export function AdminQueueList({ tab, rows, emptyTitle, urlNotice }: AdminQueueListProps) {
  const router = useRouter();
  const { submit } = useStaffTransition();
  const [notice, setNotice] = useState<string | null>(urlNotice ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (urlNotice) router.replace(`/admin?tab=${tab}`, { scroll: false });
  }, [urlNotice, tab, router]);

  async function step(id: string, from: OrderStatus, to: OrderStatus, code: NoticeCode) {
    setNotice(null);
    setError(null);
    setBusyId(id);
    const outcome = await submit(id, from, to);
    setBusyId(null);
    if (!outcome) return;
    if (outcome.ok) {
      setNotice(noticeMessage(code, id) ?? `Đơn ${id} đã chuyển sang ${ORDER_STATUS_LABELS[to]}`);
      router.refresh();
      return;
    }
    setError(outcome.message);
    if (outcome.refresh) router.refresh();
  }

  return (
    <>
      {error ? <ErrorBanner message={error} /> : notice && <StatusNotice message={notice} />}
      {rows.length === 0 ? (
        <EmptyState emoji="📦" title={emptyTitle} />
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
      )}
    </>
  );
}
