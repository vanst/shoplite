import { ProductImage } from "@/features/catalog/components/product-image";
import type { StoredOrder } from "@/features/orders/types";
import { cn } from "@/lib/cn";

interface StockReviewTableProps {
  items: StoredOrder["items"];
  /** Tồn hiện tại THÔ theo productId do server tính lúc render; thiếu = 0. */
  stock: Readonly<Record<string, number>>;
  /** Số lượng các đơn pending KHÁC đang chờ theo productId (chỉ tham khảo); thiếu = 0. */
  pendingOthers: Readonly<Record<string, number>>;
}

/** Có dòng đặt nhiều hơn Tồn hiện tại thô (thiếu = 0) thì không Xác nhận được. */
export function hasShortage(items: StoredOrder["items"], stock: Readonly<Record<string, number>>) {
  return items.some((item) => item.quantity > (stock[item.productId] ?? 0));
}

const NUM = "w-14 text-right tabular-nums sm:w-24";

/** Bảng duyệt đơn `pending`: số đặt cạnh Tồn hiện tại. Số tĩnh, chỉ mới khi tải lại trang. */
export function StockReviewTable({ items, stock, pendingOthers }: StockReviewTableProps) {
  return (
    <table className="w-full text-sm">
      <caption className="sr-only">Tồn kho các món</caption>
      <thead className="text-left text-slate-600">
        <tr>
          <th scope="col" className="py-2 font-medium">
            Sản phẩm
          </th>
          <th scope="col" className={cn(NUM, "font-medium")}>
            Đặt
          </th>
          <th scope="col" className={cn(NUM, "font-medium")}>
            Tồn hiện tại
          </th>
          <th scope="col" className={cn(NUM, "font-medium")}>
            Đang chờ (đơn khác)
          </th>
        </tr>
      </thead>
      <tbody className="divide-y divide-slate-100">
        {items.map((item) => {
          const raw = stock[item.productId] ?? 0;
          const short = item.quantity > raw;
          return (
            <tr
              key={item.productId}
              data-testid="stock-review-row"
              className={cn(short && "bg-rose-50")}
            >
              <th scope="row" className="py-3 text-left font-medium">
                <div className="flex items-center gap-3">
                  <div className="hidden w-14 shrink-0 sm:block" aria-hidden>
                    <ProductImage image={item.image} alt={item.name} size="sm" />
                  </div>
                  <div className="min-w-0 break-words">
                    {item.name}
                    {short && (
                      <p data-testid="stock-short" className="text-xs font-semibold text-rose-700">
                        Không đủ hàng
                      </p>
                    )}
                  </div>
                </div>
              </th>
              <td className={cn(NUM, "text-slate-900")}>{item.quantity}</td>
              <td data-testid="stock-current" className={cn(NUM, "text-slate-900")}>
                {Math.max(0, raw)}
              </td>
              <td data-testid="stock-pending" className={cn(NUM, "text-slate-900")}>
                {pendingOthers[item.productId] ?? 0}
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
