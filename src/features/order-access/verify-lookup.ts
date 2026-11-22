import { timingSafeEqual } from "node:crypto";
import type { StoredOrder } from "@/features/orders/types";
import { getPhoneLast4, NO_PHONE_LAST4 } from "./phone";

/** So Mã xác minh với 4 số cuối SĐT; đơn không tồn tại vẫn so với chuỗi giả để chi phí tương đương. */
export function verifyLookup(order: StoredOrder | undefined, verification: string): boolean {
  const expected = Buffer.from(order ? getPhoneLast4(order.customer.phone) : NO_PHONE_LAST4);
  const given = Buffer.from(verification.padEnd(expected.length).slice(0, expected.length));
  return timingSafeEqual(given, expected) && order !== undefined && /^\d{4}$/.test(verification);
}
