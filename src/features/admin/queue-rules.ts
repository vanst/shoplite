import { CANCEL_REASON_LABELS, type OrderStatus, type StoredOrder } from "@/features/orders/types";

// Lõi thuần của Hàng việc: chỉ import kiểu (AD-1).

export type AdminTab = "pending" | "confirmed" | "shipping" | "done";

/** Tab Hàng việc chứa đơn ở trạng thái này (`delivered` và `cancelled` cùng vào Đã xong). */
export const ADMIN_TAB_BY_STATUS: Record<OrderStatus, AdminTab> = {
  pending: "pending",
  confirmed: "confirmed",
  shipping: "shipping",
  delivered: "done",
  cancelled: "done",
};

const MINUTE_MS = 60_000;
const HOUR_MS = 60 * MINUTE_MS;
const DAY_MS = 24 * HOUR_MS;

/** Tuổi đơn đang chờ: "Chờ 59 phút" / "Chờ 3 giờ" / "Chờ 2 ngày 1 giờ" (bỏ giờ khi bằng 0). */
export function formatPendingAge(createdAt: string, now: Date): string {
  const elapsed = Math.max(0, now.getTime() - new Date(createdAt).getTime());
  if (elapsed < HOUR_MS) return `Chờ ${Math.floor(elapsed / MINUTE_MS)} phút`;
  if (elapsed < DAY_MS) return `Chờ ${Math.floor(elapsed / HOUR_MS)} giờ`;
  const days = Math.floor(elapsed / DAY_MS);
  const hours = Math.floor((elapsed % DAY_MS) / HOUR_MS);
  return hours === 0 ? `Chờ ${days} ngày` : `Chờ ${days} ngày ${hours} giờ`;
}

/** Đơn `pending` chờ quá mức này (so sánh `>`, đồng hồ liên tục) thì quá hạn. */
export const PENDING_SLA_MS = 4 * HOUR_MS;

/** Số đơn tối đa hiện trong tab Đã xong (số đếm vẫn là tổng). */
export const DONE_TAB_LIMIT = 50;

export function isOverdue(order: Pick<StoredOrder, "status" | "createdAt">, now: Date): boolean {
  return (
    order.status === "pending" &&
    now.getTime() - new Date(order.createdAt).getTime() > PENDING_SLA_MS
  );
}

/** Số lượng từng món trong các đơn `pending` KHÁC `excludeOrderId`, một lượt quét; món không ai chờ = 0. */
export function getPendingQuantities(
  orders: readonly Pick<StoredOrder, "id" | "status" | "items">[],
  productIds: readonly string[],
  excludeOrderId: string,
): Record<string, number> {
  const totals = Object.fromEntries(productIds.map((id) => [id, 0]));
  for (const order of orders) {
    if (order.status !== "pending" || order.id === excludeOrderId) continue;
    for (const item of order.items) {
      if (item.productId in totals) totals[item.productId] += item.quantity;
    }
  }
  return totals;
}

export function getPendingQuantity(
  orders: readonly Pick<StoredOrder, "id" | "status" | "items">[],
  productId: string,
  excludeOrderId: string,
): number {
  return getPendingQuantities(orders, [productId], excludeOrderId)[productId];
}

export interface QueueRow {
  id: string;
  status: OrderStatus;
  createdAt: string;
  customerName: string;
  /** Tổng số lượng các món (không phải số dòng). */
  itemCount: number;
  total: number;
  /** Chỉ đơn `pending`, tính ở server lúc render. */
  ageLabel?: string;
  overdue: boolean;
  /** Chỉ đơn `cancelled` biết người hủy: "Từ chối · Hết hàng" / "Khách tự hủy". */
  cancelLabel?: string;
}

/** Nhãn người hủy; "Từ chối · Khách hủy" (nhân viên chọn) khác "Khách tự hủy" (khách thao tác). Đơn cũ thiếu `cancelledBy`: không nhãn. */
export function getCancelLabel(
  order: Pick<StoredOrder, "status" | "cancelledBy" | "cancelReason">,
): string | undefined {
  if (order.status !== "cancelled") return undefined;
  if (order.cancelledBy === "customer") return "Khách tự hủy";
  if (order.cancelledBy === "staff" && order.cancelReason) {
    return `Từ chối · ${CANCEL_REASON_LABELS[order.cancelReason]}`;
  }
  return undefined;
}

/** Hàm duy nhất dựng `QueueRow`. */
export function toQueueRow(order: StoredOrder, now: Date): QueueRow {
  return {
    id: order.id,
    status: order.status,
    createdAt: order.createdAt,
    customerName: order.customer.fullName,
    itemCount: order.items.reduce((sum, item) => sum + item.quantity, 0),
    total: order.total,
    ageLabel: order.status === "pending" ? formatPendingAge(order.createdAt, now) : undefined,
    overdue: isOverdue(order, now),
    cancelLabel: getCancelLabel(order),
  };
}

export interface QueueGroup {
  /** Tổng số đơn của nhóm (Đã xong: không bị cắt ở 50). */
  count: number;
  rows: QueueRow[];
}

const byCreatedAsc = (a: StoredOrder, b: StoredOrder) => a.createdAt.localeCompare(b.createdAt);

/** Chia đơn thành 4 nhóm Hàng việc; không sửa đầu vào. Pending: quá hạn lên trước, mỗi phần cũ nhất trước. */
export function buildQueue(
  orders: readonly StoredOrder[],
  now: Date,
): Record<AdminTab, QueueGroup> {
  const pick = (tab: AdminTab) => orders.filter((o) => ADMIN_TAB_BY_STATUS[o.status] === tab);
  const group = (list: StoredOrder[], limit = list.length): QueueGroup => ({
    count: list.length,
    rows: list.slice(0, limit).map((o) => toQueueRow(o, now)),
  });
  const pending = pick("pending")
    .sort(byCreatedAsc)
    .sort((a, b) => Number(isOverdue(b, now)) - Number(isOverdue(a, now)));
  return {
    pending: group(pending),
    confirmed: group(pick("confirmed").sort(byCreatedAsc)),
    shipping: group(pick("shipping").sort(byCreatedAsc)),
    done: group(
      pick("done").sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
      DONE_TAB_LIMIT,
    ),
  };
}
