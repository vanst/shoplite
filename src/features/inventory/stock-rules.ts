// Quy tắc tồn kho thuần: chỉ dùng kiểu cấu trúc tối thiểu, KHÔNG import features/orders (AD-1).

/** Trạng thái đơn giữ kho: đã xác nhận trở đi. `pending` chưa giữ chỗ; `cancelled` chỉ tính điều chỉnh. */
const STOCK_HOLDING_STATUSES: ReadonlySet<string> = new Set(["confirmed", "shipping", "delivered"]);

export interface StockOrder {
  status: string;
  items: readonly { productId: string; quantity: number }[];
  /** Điều chỉnh tồn trên đơn đã hủy: số lượng không còn trong kho dù đơn bị hủy. */
  stockAdjustment?: { productId: string; quantity: number };
}

/** Tồn gốc của một sản phẩm. Sản phẩm không còn trong catalog: truyền `stock: 0`. */
export interface StockBase {
  id: string;
  stock: number;
}

/** Gom lượng đã trừ kho theo sản phẩm trong MỘT lượt quét (đơn giữ kho + điều chỉnh của đơn hủy). */
export function getConsumptionByProduct(orders: readonly StockOrder[]): Map<string, number> {
  const consumed = new Map<string, number>();
  const add = (productId: string, quantity: number) =>
    consumed.set(productId, (consumed.get(productId) ?? 0) + quantity);
  for (const order of orders) {
    if (STOCK_HOLDING_STATUSES.has(order.status)) {
      for (const item of order.items) add(item.productId, item.quantity);
    } else if (order.status === "cancelled" && order.stockAdjustment) {
      add(order.stockAdjustment.productId, order.stockAdjustment.quantity);
    }
  }
  return consumed;
}

/**
 * Tồn hiện tại = Tồn gốc - lượng đã trừ. Trả giá trị thô (có thể < 0); chỉ biên UI/API
 * mới chặn bằng `clampStock`. Không lưu: luôn tính lại từ đơn.
 */
export function computeCurrentStock(base: StockBase, orders: readonly StockOrder[]): number {
  return base.stock - (getConsumptionByProduct(orders).get(base.id) ?? 0);
}

/** Tồn hiện tại của nhiều sản phẩm bằng một lượt quét đơn. */
export function computeCurrentStocks(
  bases: readonly StockBase[],
  orders: readonly StockOrder[],
): Map<string, number> {
  const consumed = getConsumptionByProduct(orders);
  return new Map(bases.map((base) => [base.id, base.stock - (consumed.get(base.id) ?? 0)]));
}

/** Biên hiển thị: không bao giờ trả âm cho khách. */
export function clampStock(stock: number): number {
  return Math.max(0, stock);
}
