import { getTimeline } from "./order-timeline";
import { OrderError } from "./order-errors";
import {
  CANCEL_REASONS,
  ORDER_STATUS_LABELS,
  type CancelReason,
  type OrderStatus,
  type StoredOrder,
} from "./types";

/** Người thao tác: nhân viên đi tiến từng bước; khách chỉ được hủy đơn đang chờ. */
export type TransitionActor = "staff" | "customer";

export interface TransitionCommand {
  actor: TransitionActor;
  to: OrderStatus;
  /** Bắt buộc khi nhân viên hủy (`to: "cancelled"`); khách tự hủy không có lý do. */
  reason?: CancelReason;
  /** Món bị báo thiếu hàng; bắt buộc (và phải thuộc đơn) khi nhân viên hủy đơn `confirmed`. */
  productId?: string;
}

/** Bảng cặp hợp lệ theo người thao tác. `delivered` và `cancelled` là trạng thái cuối. */
const VALID_TARGETS: Record<TransitionActor, Partial<Record<OrderStatus, OrderStatus[]>>> = {
  staff: {
    pending: ["confirmed", "cancelled"],
    confirmed: ["shipping", "cancelled"],
    shipping: ["delivered"],
  },
  customer: { pending: ["cancelled"] },
};

export function isValidTransition(actor: TransitionActor, from: OrderStatus, to: OrderStatus) {
  return VALID_TARGETS[actor][from]?.includes(to) ?? false;
}

/**
 * Nơi duy nhất gán `status` khác "pending" (test tĩnh bảo vệ). Thuần: trả đối tượng mới,
 * không sửa đầu vào; cặp không hợp lệ ném 409 INVALID_STATUS_TRANSITION.
 */
export function transitionOrder(
  order: StoredOrder,
  command: TransitionCommand,
  now: Date,
): StoredOrder {
  if (!isValidTransition(command.actor, order.status, command.to)) {
    throw new OrderError(
      "INVALID_STATUS_TRANSITION",
      command.actor === "customer"
        ? "Chỉ có thể hủy đơn hàng đang ở trạng thái Chờ xác nhận"
        : `Không thể chuyển đơn từ ${ORDER_STATUS_LABELS[order.status]} sang ${ORDER_STATUS_LABELS[command.to]}`,
    );
  }
  const at = now.toISOString();
  const next = {
    ...order,
    status: command.to,
    updatedAt: at,
    // Mảng mới; vật liệu hóa lịch sử suy ra để đơn cũ không mất mốc "Đặt hàng".
    statusHistory: [...getTimeline(order), { status: command.to, at }],
  };
  if (command.to !== "cancelled") return next;
  if (command.actor === "customer") return { ...next, cancelledBy: "customer" };
  // Phòng thủ chiều sâu: Zod đã chặn ở route nhưng service không tin riêng Zod.
  if (!command.reason || !CANCEL_REASONS.includes(command.reason)) {
    throw new OrderError("VALIDATION_ERROR", "Thông tin chuyển trạng thái không hợp lệ", {
      reason: "Chọn một lý do hợp lệ",
    });
  }
  if (order.status !== "confirmed") {
    return { ...next, cancelledBy: "staff", cancelReason: command.reason };
  }
  // Báo thiếu hàng (AD-4/AD-6): lý do cố định, món phải thuộc đơn; hàng các món còn lại nguyên vẹn.
  const item = order.items.find((i) => i.productId === command.productId);
  if (command.reason !== "out_of_stock" || !item) {
    throw new OrderError("VALIDATION_ERROR", "Thông tin chuyển trạng thái không hợp lệ", {
      ...(command.reason !== "out_of_stock" && {
        reason: "Báo thiếu hàng chỉ dùng lý do Hết hàng",
      }),
      ...(!item && { productId: "Món không thuộc đơn hàng" }),
    });
  }
  return {
    ...next,
    cancelledBy: "staff",
    cancelReason: "out_of_stock",
    stockAdjustment: { productId: item.productId, quantity: item.quantity },
  };
}
