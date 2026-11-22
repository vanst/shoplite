"use client";

import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import type { ApiErrorBody } from "@/lib/http";
import type { CancelReason, OrderStatus } from "@/features/orders/types";

const SERVER_ERROR_MESSAGE = "Đã có lỗi xảy ra, vui lòng thử lại sau";
const NETWORK_ERROR_MESSAGE = "Không kết nối được máy chủ, vui lòng thử lại.";

export type TransitionOutcome =
  | { ok: true }
  /** `refresh`: dữ liệu trên màn đã cũ (409) nên cần tải lại. */
  | { ok: false; message: string; refresh: boolean };

/**
 * Gửi `PATCH /api/admin/orders/:id` với Trạng thái kỳ vọng `from`. Không cập nhật lạc quan: chỉ
 * báo kết quả. 401 chuyển tới đăng nhập (kèm `next`) và trả `undefined` để bên gọi không làm gì thêm.
 */
export function useStaffTransition({ holdOnSuccess = false } = {}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const submit = useCallback(
    async (
      id: string,
      from: OrderStatus,
      to: OrderStatus,
      reason?: CancelReason,
      productId?: string,
    ): Promise<TransitionOutcome | undefined> => {
      setPending(true);
      let succeeded = false;
      try {
        const response = await fetch(`/api/admin/orders/${encodeURIComponent(id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            from,
            to,
            ...(reason && { reason }),
            ...(productId && { productId }),
          }),
        });
        if (response.ok) {
          succeeded = true; // holdOnSuccess: giữ `pending` đến khi chuyển trang, chặn bấm đúp
          return { ok: true };
        }
        if (response.status === 401) {
          const here = `${window.location.pathname}${window.location.search}`;
          router.push(`/admin/login?next=${encodeURIComponent(here)}`);
          return undefined;
        }
        const body = (await response.json().catch(() => null)) as ApiErrorBody | null;
        const conflict = response.status === 409;
        return {
          ok: false,
          message: (conflict && body?.error?.message) || SERVER_ERROR_MESSAGE,
          refresh: conflict,
        };
      } catch {
        return { ok: false, message: NETWORK_ERROR_MESSAGE, refresh: false };
      } finally {
        if (!(succeeded && holdOnSuccess)) setPending(false);
      }
    },
    [router, holdOnSuccess],
  );

  return { pending, submit };
}
