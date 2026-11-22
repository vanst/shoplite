"use client";

import { useMemo } from "react";
import { useHydrated } from "@/lib/use-hydrated";
import { readRecentOrders } from "../recent-orders-store";

/** Mã đơn đã đặt trên máy này; chỉ là gợi ý điền ô Mã đơn, không cấp quyền xem đơn (FR-17). */
export function RecentOrdersOnDevice({ onPick }: { onPick: (orderId: string) => void }) {
  const hydrated = useHydrated();
  const ids = useMemo(() => (hydrated ? readRecentOrders() : []), [hydrated]);
  if (ids.length === 0) return null;

  return (
    <section className="mt-8 max-w-md">
      <h2 className="mb-1 text-sm font-semibold text-slate-900">Đơn đã đặt trên máy này</h2>
      <ul className="flex flex-col">
        {ids.map((id) => (
          <li key={id}>
            <button
              type="button"
              data-testid="recent-order"
              onClick={() => onPick(id)}
              className="inline-flex min-h-10 items-center text-sm font-medium text-indigo-600 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
            >
              {id}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}
