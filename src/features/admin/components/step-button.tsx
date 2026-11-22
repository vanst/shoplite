"use client";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import type { OrderStatus } from "@/features/orders/types";
import type { NoticeCode } from "../admin-notice";

/** Bước kế của nhân viên đóng gói; dòng ở trạng thái khác không có nút. */
export const STEP_BY_STATUS = {
  confirmed: { to: "shipping", label: "Bắt đầu giao" },
  shipping: { to: "delivered", label: "Đã giao xong" },
} as const satisfies Partial<Record<OrderStatus, { to: OrderStatus; label: string }>>;

export function isStepStatus(status: OrderStatus): status is keyof typeof STEP_BY_STATUS {
  return status in STEP_BY_STATUS;
}

interface StepButtonProps {
  orderId: string;
  status: keyof typeof STEP_BY_STATUS;
  /** `row`: sm, mobile md w-full; `detail`: md. */
  size?: "row" | "detail";
  pending: boolean;
  onStep(from: OrderStatus, to: OrderStatus, notice: NoticeCode): void;
}

/** Nút chuyển Đang giao / Đã giao. Chỉ gửi yêu cầu qua `onStep`; bên gọi lo kết quả. */
export function StepButton({ orderId, status, size = "row", pending, onStep }: StepButtonProps) {
  const { to, label } = STEP_BY_STATUS[status];
  return (
    <Button
      data-testid="step-button"
      size={size === "row" ? "sm" : "md"}
      className={cn(size === "row" && "max-sm:h-10 max-sm:w-full")}
      disabled={pending}
      onClick={() => onStep(status, to, to === "shipping" ? "shipping" : "delivered")}
    >
      {pending ? (
        "Đang chuyển…"
      ) : (
        <span>
          {label} <span className="sr-only">đơn {orderId}</span>
        </span>
      )}
    </Button>
  );
}
