"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { requestRejectionNoticeFocus } from "./rejection-notice";
import type { ApiErrorBody } from "@/lib/http";

const NETWORK_ERROR = "Không kết nối được máy chủ, vui lòng thử lại.";
const SESSION_EXPIRED = "Phiên xem đơn đã hết, vui lòng tra cứu lại";

type CancelError = { message: string; expired?: boolean };

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<CancelError | null>(null);
  const openRef = useRef<HTMLButtonElement>(null);
  const confirmRef = useRef<HTMLButtonElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const refocusOpen = useRef(false);

  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
    else if (refocusOpen.current) {
      refocusOpen.current = false;
      openRef.current?.focus();
    }
  }, [confirming]);

  useEffect(() => {
    if (error) errorRef.current?.focus();
  }, [error]);

  async function cancelOrder() {
    setPending(true);
    setError(null);
    try {
      const response = await fetch(`/api/orders/${orderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (response.ok) {
        setConfirming(false);
        router.refresh();
        requestRejectionNoticeFocus(); // nút biến mất sau khi tải lại; focus sang "Bạn đã hủy đơn"
        return;
      }
      if (response.status === 401) {
        setError({ message: SESSION_EXPIRED, expired: true });
        return;
      }
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      setError({ message: body?.error?.message ?? "Không thể hủy đơn hàng" });
      if (response.status === 409) router.refresh(); // đơn đã đổi trạng thái ở nơi khác
    } catch {
      setError({ message: NETWORK_ERROR });
    } finally {
      setPending(false);
    }
  }

  if (!confirming) {
    return (
      <Button ref={openRef} variant="secondary" onClick={() => setConfirming(true)}>
        Hủy đơn hàng
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-labelledby="cancel-order-question"
      className="flex flex-col gap-2 rounded-xl bg-rose-50 p-4 text-sm"
    >
      <p id="cancel-order-question" className="font-medium text-rose-900">
        Bạn chắc chắn muốn hủy đơn hàng này?
      </p>
      <div className="flex gap-2">
        <Button
          ref={confirmRef}
          variant="danger"
          size="sm"
          aria-describedby="cancel-order-question"
          onClick={cancelOrder}
          disabled={pending}
        >
          {pending ? "Đang hủy…" : "Xác nhận hủy"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            refocusOpen.current = true;
            setConfirming(false);
          }}
          disabled={pending}
        >
          Không
        </Button>
      </div>
      {error && (
        <div ref={errorRef} tabIndex={-1} className="text-rose-700 outline-none">
          {error.message}
          {error.expired && (
            <>
              {" "}
              <Link href={`/orders/${orderId}`} className="font-medium underline">
                Tra cứu lại
              </Link>
            </>
          )}
        </div>
      )}
    </div>
  );
}
