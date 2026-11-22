"use client";

import { Check } from "lucide-react";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { CANCEL_REASON_LABELS, CANCEL_REASONS, type CancelReason } from "@/features/orders/types";
import { useOrderActions } from "./order-actions";

const REASON_ID = "review-short-reason";
const HINT_ID = "reject-submit-hint";

/** Thay chỗ ReviewActions khi nhân viên bấm "Từ chối": chọn đúng một lý do rồi gửi. */
function RejectReasonPanel({ onClose }: { onClose: () => void }) {
  const { pending, reject } = useOrderActions();
  const [reason, setReason] = useState<CancelReason | null>(null);

  return (
    <fieldset
      data-testid="reject-reason-panel"
      className="mt-4 flex flex-col gap-3 rounded-xl bg-rose-50 p-4"
    >
      <legend className="px-1 text-sm font-semibold text-rose-900">Lý do từ chối</legend>
      <div className="grid gap-2 sm:grid-cols-3">
        {CANCEL_REASONS.map((code, index) => (
          <label
            key={code}
            className={cn(
              "flex cursor-pointer items-center justify-between gap-2 rounded-xl p-3 text-sm font-medium text-slate-900",
              "has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-indigo-600",
              reason === code
                ? "bg-indigo-50 ring-2 ring-indigo-600"
                : "bg-white ring-1 ring-slate-500",
            )}
          >
            <input
              type="radio"
              name="reject-reason"
              value={code}
              className="sr-only"
              autoFocus={index === 0}
              checked={reason === code}
              disabled={pending}
              onChange={() => setReason(code)}
            />
            {CANCEL_REASON_LABELS[code]}
            {reason === code && <Check aria-hidden className="size-4 text-indigo-600" />}
          </label>
        ))}
      </div>
      <p className="text-sm text-slate-600">Khách sẽ thấy lý do này.</p>
      <div className="flex flex-col items-end gap-2">
        {!reason && (
          <p id={HINT_ID} className="text-sm text-slate-600">
            Chọn một lý do để từ chối
          </p>
        )}
        <div className="flex gap-2">
          <Button variant="ghost" size="sm" disabled={pending} onClick={onClose}>
            Thôi
          </Button>
          <Button
            variant="danger"
            size="sm"
            data-testid="reject-submit"
            disabled={!reason || pending}
            aria-describedby={reason ? undefined : HINT_ID}
            onClick={() => reason && void reject(reason)}
          >
            {pending ? "Đang từ chối…" : "Từ chối đơn"}
          </Button>
        </div>
      </div>
    </fieldset>
  );
}

/** Chân thẻ "Sản phẩm" của đơn `pending`: Xác nhận hoặc Từ chối (panel thế chỗ hàng nút). */
export function ReviewActions({ short }: { short: boolean }) {
  const { pending, run } = useOrderActions();
  const [rejecting, setRejecting] = useState(false);
  const rejectRef = useRef<HTMLButtonElement>(null);

  if (rejecting) {
    return (
      <RejectReasonPanel
        onClose={() => {
          setRejecting(false);
          // Nút "Từ chối" mount lại sau commit này.
          requestAnimationFrame(() => rejectRef.current?.focus());
        }}
      />
    );
  }

  return (
    <div className="mt-4 flex flex-col items-end gap-2">
      {short && (
        <p id={REASON_ID} className="text-sm font-medium text-rose-700">
          Có món không đủ hàng, chỉ có thể từ chối đơn.
        </p>
      )}
      <div className="flex gap-2">
        <Button
          ref={rejectRef}
          variant="secondary"
          data-testid="reject-order-button"
          disabled={pending}
          onClick={() => setRejecting(true)}
        >
          Từ chối
        </Button>
        <Button
          data-testid="confirm-order-button"
          aria-disabled={short ? true : undefined}
          aria-label={short ? "Không thể xác nhận đơn: Không đủ hàng" : undefined}
          aria-describedby={short ? REASON_ID : undefined}
          className="aria-disabled:opacity-50"
          disabled={pending}
          onClick={() => {
            if (!short) void run("pending", "confirmed", "confirmed");
          }}
        >
          {short ? "Không đủ hàng" : pending ? "Đang xác nhận…" : "Xác nhận đơn"}
        </Button>
      </div>
    </div>
  );
}
