"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ProductImage } from "@/features/catalog/components/product-image";
import type { StoredOrder } from "@/features/orders/types";
import { formatCurrency } from "@/lib/format";
import { useOrderActions } from "./order-actions";

/** Danh sách món của đơn `confirmed`, mỗi dòng có "Báo thiếu hàng" (hộp xác nhận ngay dưới dòng, Story 5.7). */
export function ShortageReport({ items }: { items: StoredOrder["items"] }) {
  const { pending, reportShortage } = useOrderActions();
  const [openId, setOpenId] = useState<string | null>(null);
  const buttons = useRef(new Map<string, HTMLButtonElement>());

  const close = (productId: string) => {
    setOpenId(null);
    buttons.current.get(productId)?.focus();
  };

  return (
    <ul className="divide-y divide-slate-100">
      {items.map((item) => (
        <li key={item.productId} className="py-3">
          <div className="flex items-center gap-4">
            <div className="w-14 shrink-0">
              <ProductImage image={item.image} alt={item.name} size="sm" />
            </div>
            <div className="flex-1">
              <p className="font-medium">{item.name}</p>
              <p className="text-sm text-slate-600">
                {formatCurrency(item.unitPrice)} × {item.quantity}
              </p>
            </div>
            <span className="font-semibold">{formatCurrency(item.lineTotal)}</span>
            <Button
              ref={(el) => {
                if (el) buttons.current.set(item.productId, el);
                else buttons.current.delete(item.productId);
              }}
              variant="ghost"
              size="sm"
              data-testid="shortage-report-button"
              aria-label={`Báo thiếu hàng: ${item.name}`}
              aria-expanded={openId === item.productId}
              disabled={pending}
              onClick={() => setOpenId(item.productId)}
            >
              Báo thiếu hàng
            </Button>
          </div>
          {openId === item.productId && (
            <div
              data-testid="shortage-confirm-box"
              className="mt-3 flex flex-col gap-3 rounded-xl bg-rose-50 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <p className="text-sm text-rose-900">
                Đơn sẽ bị từ chối với lý do Hết hàng và tồn của {item.name} được điều chỉnh.
              </p>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={pending}
                  onClick={() => close(item.productId)}
                >
                  Thôi
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  data-testid="shortage-confirm"
                  autoFocus
                  disabled={pending}
                  onClick={() => void reportShortage(item.productId)}
                >
                  Báo thiếu hàng
                </Button>
              </div>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}
