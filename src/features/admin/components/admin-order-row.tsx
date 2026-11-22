import Link from "next/link";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { cn } from "@/lib/cn";
import { formatCurrency, formatDateTime } from "@/lib/format";
import type { OrderStatus } from "@/features/orders/types";
import type { NoticeCode } from "../admin-notice";
import type { QueueRow } from "../queue-rules";
import { PendingAge } from "./pending-age";
import { isStepStatus, StepButton } from "./step-button";

/** Một dòng Hàng việc. Tuổi đơn đã tính ở server (`ageLabel`), không tự đếm ở client. */
export function AdminOrderRow({
  row,
  stepPending = false,
  onStep,
}: {
  row: QueueRow;
  stepPending?: boolean;
  /** Có thì dòng `confirmed`/`shipping` hiện StepButton. */
  onStep?: (from: OrderStatus, to: OrderStatus, notice: NoticeCode) => void;
}) {
  return (
    <li
      data-testid="admin-order-row"
      className={cn(
        "rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200",
        row.overdue && "border-l-4 border-rose-600 bg-rose-50",
      )}
    >
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
        <Link
          href={`/admin/orders/${row.id}`}
          className="font-semibold text-indigo-700 hover:underline"
        >
          {row.id}
        </Link>
        <OrderStatusBadge status={row.status} />
        {row.ageLabel && <PendingAge label={row.ageLabel} overdue={row.overdue} />}
        <span className="ml-auto font-bold text-slate-900">{formatCurrency(row.total)}</span>
      </div>
      <p className={cn("mt-1 text-sm", row.overdue ? "text-slate-600" : "text-slate-500")}>
        {formatDateTime(row.createdAt)} · {row.customerName} · {row.itemCount} sản phẩm
        {row.cancelLabel && ` · ${row.cancelLabel}`}
      </p>
      {onStep && isStepStatus(row.status) && (
        <div className="mt-3 flex sm:justify-end">
          <StepButton orderId={row.id} status={row.status} pending={stepPending} onStep={onStep} />
        </div>
      )}
    </li>
  );
}
