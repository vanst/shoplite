import { products } from "@/data/products";
import { countCancellations } from "@/features/orders/cancel-stats";
import { getTimeline } from "@/features/orders/order-timeline";
import type { StoredOrder } from "@/features/orders/types";

export const SLA_MS = 4 * 60 * 60 * 1000;

export interface OrderMetrics {
  totalOrders: number;
  /** SM-1: Từ chối "Hết hàng" (gồm Báo thiếu hàng) / tổng đơn đã tạo. Null khi chưa có đơn. */
  sm1: number | null;
  /** SM-C1: Từ chối "Khách hủy" + "Không liên lạc được" / tổng đơn. */
  smC1: number | null;
  /** SM-2: số sản phẩm có tổng số lượng đã confirmed|shipping|delivered vượt Tồn gốc. */
  sm2: number;
  /** SM-4: đơn nhân viên Xác nhận/Từ chối trong 4 giờ / đơn đã quyết định hoặc đã quá 4 giờ. Null khi chưa có mẫu. */
  sm4: number | null;
  /** SM-C3: trung vị ms từ lúc đặt đến Xác nhận. Null khi chưa có đơn nào được Xác nhận. */
  smC3Ms: number | null;
}

const ratio = (n: number, d: number) => (d === 0 ? null : n / d);

/** Thuần, chỉ đọc dữ liệu đơn. Khách tự hủy và đơn cũ không rõ người hủy không tính vào SM-1/SM-C1/SM-4. */
export function computeOrderMetrics(orders: readonly StoredOrder[], now: Date): OrderMetrics {
  const sold = new Map<string, number>();
  const confirmDelays: number[] = [];
  let decidedInSla = 0;
  let eligible = 0;

  for (const order of orders) {
    const staffRejected = order.status === "cancelled" && order.cancelledBy === "staff";
    if (["confirmed", "shipping", "delivered"].includes(order.status)) {
      for (const { productId, quantity } of order.items) {
        sold.set(productId, (sold.get(productId) ?? 0) + quantity);
      }
    }

    const created = Date.parse(order.createdAt);
    const timeline = getTimeline(order);
    const confirmedAt = timeline.find((e) => e.status === "confirmed")?.at;
    if (confirmedAt) confirmDelays.push(Date.parse(confirmedAt) - created);

    const customerCancelled = order.status === "cancelled" && !staffRejected;
    if (customerCancelled) continue; // khách tự hủy hoặc đơn cũ không rõ: không phải quyết định của shop
    const decidedAt = confirmedAt ?? (staffRejected ? timeline.at(-1)?.at : undefined);
    if (decidedAt) {
      eligible++;
      if (Date.parse(decidedAt) - created <= SLA_MS) decidedInSla++;
    } else if (now.getTime() - created > SLA_MS) eligible++; // pending quá hạn: trượt SLA
  }

  confirmDelays.sort((a, b) => a - b);
  const mid = confirmDelays.length >> 1;
  const median =
    confirmDelays.length === 0
      ? null
      : confirmDelays.length % 2
        ? confirmDelays[mid]
        : (confirmDelays[mid - 1] + confirmDelays[mid]) / 2;

  const { rejected } = countCancellations(orders);
  const stockById = new Map(products.map((p) => [p.id, p.stock]));
  return {
    totalOrders: orders.length,
    sm1: ratio(rejected.out_of_stock, orders.length),
    smC1: ratio(rejected.customer_cancelled + rejected.unreachable, orders.length),
    sm2: [...sold].filter(([id, qty]) => qty > (stockById.get(id) ?? Infinity)).length,
    sm4: ratio(decidedInSla, eligible),
    smC3Ms: median,
  };
}
