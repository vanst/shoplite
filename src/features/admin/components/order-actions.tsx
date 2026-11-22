"use client";

import { useRouter } from "next/navigation";
import { createContext, useContext, useState, type ReactNode } from "react";
import type { CancelReason, OrderStatus } from "@/features/orders/types";
import { type NoticeCode, noticeUrl } from "../admin-notice";
import { ADMIN_TAB_BY_STATUS } from "../queue-rules";
import { type TransitionOutcome, useStaffTransition } from "../use-staff-transition";
import { ErrorBanner } from "./admin-feedback";

interface OrderActions {
  pending: boolean;
  /** Gửi chuyển trạng thái; thành công thì sang Hàng việc (tab `tab`) kèm StatusNotice. */
  run(
    from: OrderStatus,
    to: OrderStatus,
    notice: NoticeCode,
    tab?: string,
    reason?: CancelReason,
    productId?: string,
  ): Promise<void>;
  /** Từ chối đơn `pending` với một lý do (Story 5.3). */
  reject(reason: CancelReason): Promise<void>;
  /** Báo thiếu hàng một món của đơn `confirmed` (Story 5.7). */
  reportShortage(productId: string): Promise<void>;
}

const OrderActionsContext = createContext<OrderActions | null>(null);
const ErrorContext = createContext<string | null>(null);

/** Trạng thái thao tác chung của màn chi tiết: nút ở đầu trang và ReviewActions dùng chung một lỗi. */
export function OrderActionsProvider({
  orderId,
  children,
}: {
  orderId: string;
  children: ReactNode;
}) {
  const router = useRouter();
  const { pending, submit } = useStaffTransition({ holdOnSuccess: true });
  const [error, setError] = useState<string | null>(null);

  const actions: OrderActions = {
    pending,
    async run(from, to, notice, tab = ADMIN_TAB_BY_STATUS[from], reason, productId) {
      setError(null);
      const outcome: TransitionOutcome | undefined = await submit(
        orderId,
        from,
        to,
        reason,
        productId,
      );
      if (!outcome) return;
      if (outcome.ok) {
        router.push(noticeUrl(tab, notice, orderId));
        return;
      }
      setError(outcome.message);
      if (outcome.refresh) router.refresh();
    },
    reject: (reason) => actions.run("pending", "cancelled", "rejected", undefined, reason),
    reportShortage: (productId) =>
      actions.run("confirmed", "cancelled", "shortage", undefined, "out_of_stock", productId),
  };

  return (
    <OrderActionsContext value={actions}>
      <ErrorContext value={error}>{children}</ErrorContext>
    </OrderActionsContext>
  );
}

export function useOrderActions(): OrderActions {
  const ctx = useContext(OrderActionsContext);
  if (!ctx) throw new Error("useOrderActions phải nằm trong OrderActionsProvider");
  return ctx;
}

/** Chỗ hiện lỗi thao tác (dưới phần đầu màn chi tiết). */
export function OrderActionError() {
  const error = useContext(ErrorContext);
  return error ? <ErrorBanner message={error} /> : null;
}
