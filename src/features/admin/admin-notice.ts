import { ORDER_STATUS_LABELS } from "@/features/orders/types";

/** Mã `notice` hợp lệ trên URL Hàng việc; mã khác bị bỏ qua. */
export const NOTICE_CODES = ["confirmed", "rejected", "shipping", "delivered", "shortage"] as const;
export type NoticeCode = (typeof NOTICE_CODES)[number];

const ORDER_ID_PATTERN = /^SL-\d{8}-[0-9A-F]{6}$/;

/** Câu StatusNotice cho một kết quả thao tác (dùng chung URL và dòng hàng việc). */
export function noticeMessage(code: NoticeCode, id: string): string | undefined {
  if (code === "confirmed") return `Đã xác nhận đơn ${id}`;
  if (code === "rejected") return `Đã từ chối đơn ${id}`;
  if (code === "shortage") return `Đã báo thiếu hàng, đơn ${id} bị từ chối`;
  if (code === "shipping" || code === "delivered") {
    return `Đơn ${id} đã chuyển sang ${ORDER_STATUS_LABELS[code]}`;
  }
  return undefined;
}

/** Đọc `?notice=&order=` thành câu hiển thị; mã lạ, mã chưa có câu chữ hoặc mã đơn sai dạng thì bỏ qua. */
export function parseNotice(notice: unknown, order: unknown): string | undefined {
  if (typeof notice !== "string" || typeof order !== "string") return undefined;
  if (!ORDER_ID_PATTERN.test(order)) return undefined;
  const code = NOTICE_CODES.find((c) => c === notice);
  return code && noticeMessage(code, order);
}

export function noticeUrl(tab: string, code: NoticeCode, id: string): string {
  return `/admin?tab=${tab}&notice=${code}&order=${encodeURIComponent(id)}`;
}
