"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";

let focusOnMount = false;

/** Gọi sau khi khách hủy đơn: lần RejectionNotice kế tiếp xuất hiện sẽ nhận focus. */
export function requestRejectionNoticeFocus() {
  focusOnMount = true;
}

interface RejectionNoticeProps {
  cancelledBy: "customer" | "staff";
  reasonLabel?: string;
  /** Chỉ truyền khi lý do là Hết hàng và món đầu còn trong catalog. */
  categoryHref?: string;
}

export function RejectionNotice({ cancelledBy, reasonLabel, categoryHref }: RejectionNoticeProps) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!focusOnMount) return;
    focusOnMount = false;
    ref.current?.focus();
  }, []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      data-testid="rejection-notice"
      className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-900 ring-1 ring-slate-200 outline-none"
    >
      <p>
        {cancelledBy === "customer"
          ? "Bạn đã hủy đơn"
          : `Shop đã từ chối đơn${reasonLabel ? `, lý do: ${reasonLabel}` : ""}`}
      </p>
      {cancelledBy === "staff" && categoryHref && (
        <Link
          href={categoryHref}
          className="mt-1 inline-block rounded font-medium text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          Xem sản phẩm cùng danh mục
        </Link>
      )}
    </div>
  );
}
