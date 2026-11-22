"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";

/** "Làm mới" Hàng việc: `router.refresh()`, xong thì StatusNotice cục bộ nhận focus. */
export function AdminRefreshButton() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [clicked, setClicked] = useState(false);
  const noticeRef = useRef<HTMLParagraphElement>(null);
  const showNotice = clicked && !pending;

  useEffect(() => {
    if (showNotice) noticeRef.current?.focus();
  }, [showNotice]);

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        data-testid="admin-refresh"
        disabled={pending}
        onClick={() => {
          setClicked(true);
          startTransition(() => {
            router.refresh();
          });
        }}
      >
        {pending ? "Đang làm mới…" : "Làm mới"}
      </Button>
      {showNotice && (
        <p
          ref={noticeRef}
          tabIndex={-1}
          data-testid="status-notice"
          className="basis-full rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200"
        >
          Đã làm mới danh sách
        </p>
      )}
    </>
  );
}
