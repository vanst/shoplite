import { useEffect, useRef } from "react";
import { cartStore } from "./cart-store";

/** Làm mới `stock` của giỏ từ GET /api/stock. Lỗi mạng hoặc 500 bị bỏ qua êm (giữ stock cũ). */
export async function syncCartStock(): Promise<void> {
  try {
    const response = await fetch("/api/stock");
    if (!response.ok) return;
    const body = (await response.json()) as { stock?: Record<string, number> };
    if (body.stock && typeof body.stock === "object") {
      cartStore.dispatch({ type: "sync-stock", stock: body.stock });
    }
  } catch {
    // Không hiện lỗi: server vẫn là chốt chặn cuối lúc đặt hàng.
  }
}

/** Đồng bộ tồn một lần khi trang mở và giỏ không rỗng (gọi sau `hydrated`). */
export function useSyncCartStock(enabled: boolean): void {
  const done = useRef(false);
  useEffect(() => {
    if (!enabled || done.current) return;
    done.current = true;
    void syncCartStock();
  }, [enabled]);
}
