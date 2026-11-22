import { ORDER_STATUS_LABELS, type StatusHistoryEntry, type StoredOrder } from "./types";

/**
 * Các mốc trạng thái theo thời gian tăng dần. Đơn cũ không có `statusHistory`: suy ra từ
 * `createdAt`/`updatedAt` (mốc trạng thái hiện tại lấy `updatedAt` [ASSUMPTION]). Trả mảng mới.
 */
export function getTimeline(order: StoredOrder): StatusHistoryEntry[] {
  if (order.statusHistory) {
    return order.statusHistory
      .map(({ status, at }) => ({ status, at }))
      .sort((a, b) => a.at.localeCompare(b.at));
  }
  const timeline: StatusHistoryEntry[] = [{ status: "pending", at: order.createdAt }];
  if (order.status !== "pending") timeline.push({ status: order.status, at: order.updatedAt });
  return timeline;
}

export interface TimelineView {
  label: string;
  at: string;
}

/** Mốc để hiển thị, tăng dần: mốc đầu là "Đặt hàng", các mốc sau là nhãn trạng thái. Không chứa lý do hủy. */
export function getTimelineView(order: StoredOrder): TimelineView[] {
  return getTimeline(order).map(({ status, at }, i) => ({
    label: i === 0 ? "Đặt hàng" : ORDER_STATUS_LABELS[status],
    at,
  }));
}
