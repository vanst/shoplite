import { OrderLookupForm } from "./order-lookup-form";
import { OrderLookupWithRecent } from "./order-lookup-with-recent";

/** Khối tra cứu dùng chung cho /orders và /orders/[id] khi chưa có quyền xem. */
export function OrderLookupPanel({
  description,
  initialOrderId,
  showRecent = false,
}: {
  description: string;
  initialOrderId?: string;
  /** Hiện "Đơn đã đặt trên máy này" (chỉ ở /orders). */
  showRecent?: boolean;
}) {
  return (
    <div className="mx-auto max-w-md px-4 py-10">
      <h1 className="mb-2 text-2xl font-bold">Tra cứu đơn hàng</h1>
      <p className="mb-6 text-sm text-slate-600">{description}</p>
      {showRecent ? (
        <OrderLookupWithRecent initialOrderId={initialOrderId} />
      ) : (
        <OrderLookupForm initialOrderId={initialOrderId} />
      )}
    </div>
  );
}
