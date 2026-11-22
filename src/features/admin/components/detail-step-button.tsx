"use client";

import type { OrderStatus } from "@/features/orders/types";
import { useOrderActions } from "./order-actions";
import { isStepStatus, StepButton } from "./step-button";

/** StepButton ở đầu màn chi tiết đơn `confirmed`/`shipping`; trạng thái khác không hiện. */
export function DetailStepButton({ orderId, status }: { orderId: string; status: OrderStatus }) {
  const { pending, run } = useOrderActions();
  if (!isStepStatus(status)) return null;
  return (
    <StepButton
      orderId={orderId}
      status={status}
      size="detail"
      pending={pending}
      onStep={(from, to, notice) => void run(from, to, notice)}
    />
  );
}
