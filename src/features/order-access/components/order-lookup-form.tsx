"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent, type RefObject } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { ApiErrorBody } from "@/lib/http";
import { useHydrated } from "@/lib/use-hydrated";

const SERVER_ERROR_MESSAGE = "Đã có lỗi xảy ra, vui lòng thử lại sau";
const NETWORK_ERROR_MESSAGE = "Không kết nối được máy chủ, vui lòng thử lại.";

const inputClass =
  "h-11 w-full rounded-xl border-0 bg-white px-3 text-sm ring-1 ring-inset placeholder:text-slate-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600";

type FieldErrors = { orderId?: string; verification?: string };

interface OrderLookupFormProps {
  initialOrderId?: string;
  /** Bao ngoài có thể giữ giá trị ô Mã đơn và ref ô xác minh (Story 6.3); không truyền thì tự quản. */
  orderId?: string;
  onOrderIdChange?: (value: string) => void;
  verificationRef?: RefObject<HTMLInputElement | null>;
}

export function OrderLookupForm({
  initialOrderId = "",
  orderId: controlledOrderId,
  onOrderIdChange,
  verificationRef: sharedVerificationRef,
}: OrderLookupFormProps) {
  const router = useRouter();
  const hydrated = useHydrated();
  const [ownOrderId, setOwnOrderId] = useState(initialOrderId);
  const orderId = controlledOrderId ?? ownOrderId;
  const setOrderId = onOrderIdChange ?? setOwnOrderId;
  const [verification, setVerification] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const orderRef = useRef<HTMLInputElement>(null);
  const ownVerificationRef = useRef<HTMLInputElement>(null);
  const verificationRef = sharedVerificationRef ?? ownVerificationRef;
  const bannerRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    if (banner) bannerRef.current?.focus();
  }, [banner]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;
    setBanner(null);

    const next: FieldErrors = {};
    if (orderId === "") next.orderId = "Vui lòng nhập mã đơn";
    if (verification === "") next.verification = "Vui lòng nhập 4 số cuối số điện thoại";
    else if (verification.length < 4) next.verification = "Nhập đủ 4 chữ số";
    setErrors(next);
    if (next.orderId || next.verification) {
      (next.orderId ? orderRef : verificationRef).current?.focus();
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId, verification }),
      });
      if (response.ok) {
        router.push(`/orders/${encodeURIComponent(orderId)}`);
        router.refresh(); // trang đơn phải đọc lại cookie grant vừa cấp
        return;
      }
      const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
      const useServerMessage = response.status === 404 || response.status === 429;
      setBanner((useServerMessage ? body?.error?.message : undefined) ?? SERVER_ERROR_MESSAGE);
    } catch {
      setBanner(NETWORK_ERROR_MESSAGE);
    }
    setSubmitting(false);
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      data-testid="order-lookup-form"
      className="flex max-w-md flex-col gap-4"
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor="lookup-order-id" className="text-sm font-medium text-slate-700">
          Mã đơn
        </label>
        <input
          ref={orderRef}
          id="lookup-order-id"
          name="orderId"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          value={orderId}
          onChange={(event) => setOrderId(event.target.value.replace(/\s+/g, "").toUpperCase())}
          aria-invalid={errors.orderId !== undefined}
          aria-describedby={errors.orderId ? "lookup-order-id-error" : undefined}
          className={cn(inputClass, errors.orderId ? "ring-rose-400" : "ring-slate-300")}
        />
        {errors.orderId && (
          <p id="lookup-order-id-error" className="text-xs text-rose-600">
            {errors.orderId}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="lookup-verification" className="text-sm font-medium text-slate-700">
          4 số cuối số điện thoại
        </label>
        <input
          ref={verificationRef}
          id="lookup-verification"
          name="verification"
          inputMode="numeric"
          maxLength={4}
          pattern="[0-9]{4}"
          autoComplete="off"
          value={verification}
          onChange={(event) => setVerification(event.target.value.replace(/\D/g, "").slice(-4))}
          // maxLength cắt chuỗi dán ở 4 ký tự đầu, nên tự xử lý để giữ 4 số cuối
          onPaste={(event) => {
            event.preventDefault();
            setVerification(event.clipboardData.getData("text").replace(/\D/g, "").slice(-4));
          }}
          aria-invalid={errors.verification !== undefined}
          aria-describedby={errors.verification ? "lookup-verification-error" : undefined}
          className={cn(inputClass, errors.verification ? "ring-rose-400" : "ring-slate-300")}
        />
        {errors.verification && (
          <p id="lookup-verification-error" className="text-xs text-rose-600">
            {errors.verification}
          </p>
        )}
      </div>
      {banner && (
        <p
          ref={bannerRef}
          tabIndex={-1}
          data-testid="lookup-error"
          className="rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
        >
          {banner}
        </p>
      )}
      {/* Khóa nút tới khi hydrate xong: submit native sẽ đưa dữ liệu lên URL bằng GET */}
      <Button type="submit" size="lg" className="w-full" disabled={submitting || !hydrated}>
        {submitting ? "Đang tra cứu…" : "Tra cứu"}
      </Button>
    </form>
  );
}
