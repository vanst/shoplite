/** Mã đơn gần đây trên máy này: chỉ mã (không PII, không Mã xác minh), tối đa 5, mới nhất trước. */
export const RECENT_ORDERS_KEY = "shoplite:recent-orders";
export const MAX_RECENT_ORDERS = 5;

const ORDER_ID_PATTERN = /^SL-\d{8}-[A-Z0-9]{6}$/;

/** Đọc danh sách; dữ liệu hỏng hoặc localStorage bị chặn thì trả rỗng, không ném lỗi. */
export function readRecentOrders(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_ORDERS_KEY) ?? "[]");
    if (!Array.isArray(parsed)) return [];
    const valid = parsed.filter(
      (id): id is string => typeof id === "string" && ORDER_ID_PATTERN.test(id),
    );
    return [...new Set(valid)].slice(0, MAX_RECENT_ORDERS);
  } catch {
    return [];
  }
}

/** Ghi mã vừa đặt thành công lên đầu; mã thứ 6 đẩy mã cũ nhất ra. Bị chặn thì bỏ qua. */
export function addRecentOrder(id: string): void {
  if (!ORDER_ID_PATTERN.test(id)) return;
  const next = [id, ...readRecentOrders().filter((existing) => existing !== id)].slice(
    0,
    MAX_RECENT_ORDERS,
  );
  try {
    window.localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify(next));
  } catch {
    // localStorage bị chặn (chế độ ẩn danh): đặt hàng vẫn thành công, chỉ không nhớ mã
  }
}
