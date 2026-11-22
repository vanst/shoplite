import { OrderError } from "@/features/orders/order-errors";

const MAX_ORDER_ID_LENGTH = 32;

/** Hàm duy nhất chuẩn hóa mã đơn: trim, bỏ mọi khoảng trắng, in hoa; dài hơn 32 ký tự thì ném 400. */
export function canonicalOrderId(raw: string): string {
  const id = raw.replace(/\s+/g, "").toUpperCase();
  if (id.length > MAX_ORDER_ID_LENGTH) {
    throw new OrderError("VALIDATION_ERROR", "Mã đơn hàng không hợp lệ");
  }
  return id;
}
