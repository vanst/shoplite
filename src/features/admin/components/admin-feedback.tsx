"use client";

import { useEffect, useRef } from "react";

/** Khung phản hồi nhận focus khi hiện (UX-DR28); không `role` live để tránh đọc trùng. */
function useFocusOnShow(message: string | null | undefined) {
  const ref = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    if (message) ref.current?.focus();
  }, [message]);
  return ref;
}

export function StatusNotice({ message }: { message: string }) {
  const ref = useFocusOnShow(message);
  return (
    <p
      ref={ref}
      tabIndex={-1}
      data-testid="status-notice"
      className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900 ring-1 ring-emerald-200 outline-none"
    >
      {message}
    </p>
  );
}

export function ErrorBanner({ message }: { message: string }) {
  const ref = useFocusOnShow(message);
  return (
    <p
      ref={ref}
      tabIndex={-1}
      data-testid="conflict-banner"
      className="rounded-xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-800 ring-1 ring-rose-200 outline-none"
    >
      {message}
    </p>
  );
}
