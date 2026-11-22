import type { CancelReason, StoredOrder } from "./types";

export interface CancelStats {
  /** Đơn nhân viên Từ chối, đếm theo từng lý do. */
  rejected: Record<CancelReason, number>;
  customerCancelled: number;
  /** Đơn `cancelled` cũ thiếu `cancelledBy`. */
  unknown: number;
}

/** Cơ sở đo SM-1: chỉ đọc `cancelledBy` và `cancelReason` của đơn đã hủy. */
export function countCancellations(orders: readonly StoredOrder[]): CancelStats {
  const stats: CancelStats = {
    rejected: { out_of_stock: 0, customer_cancelled: 0, unreachable: 0 },
    customerCancelled: 0,
    unknown: 0,
  };
  for (const { status, cancelledBy, cancelReason } of orders) {
    if (status !== "cancelled") continue;
    if (cancelledBy === "customer") stats.customerCancelled++;
    else if (cancelledBy === "staff" && cancelReason) stats.rejected[cancelReason]++;
    else stats.unknown++;
  }
  return stats;
}
