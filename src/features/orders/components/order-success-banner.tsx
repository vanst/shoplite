"use client";

import { CircleCheck } from "lucide-react";
import { useEffect, useRef } from "react";

/** Chỉ chứa mã đơn: không họ tên, không SĐT. Nhận focus khi mount để người dùng đọc được thông báo. */
export function OrderSuccessBanner({ orderId }: { orderId: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => ref.current?.focus(), []);

  return (
    <div
      ref={ref}
      tabIndex={-1}
      className="flex items-start gap-3 rounded-2xl bg-emerald-50 p-5 text-emerald-900 ring-1 ring-emerald-200 outline-none"
    >
      <CircleCheck className="mt-0.5 size-6 shrink-0 text-emerald-600" aria-hidden />
      <div>
        <p className="font-semibold">Đặt hàng thành công!</p>
        <p className="text-sm">
          Lưu mã đơn <strong>{orderId}</strong> và 4 số cuối số điện thoại để tra cứu sau
        </p>
      </div>
    </div>
  );
}
