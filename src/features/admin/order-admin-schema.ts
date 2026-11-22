import { z } from "zod";
import { CANCEL_REASONS, ORDER_STATUSES } from "@/features/orders/types";

const statusField = (label: string) => z.enum(ORDER_STATUSES, { error: `${label} không hợp lệ` });

/**
 * Body PATCH /api/admin/orders/:id. Union phân biệt theo `to` để Epic 5 thêm biến thể
 * (lý do, productId) mà không đổi route. Không có trường tiền hay tồn (AD-8): trường lạ bị bỏ.
 * Cặp from/to có hợp lệ hay không do `transitionOrder` quyết định, không phải schema.
 */
export const staffTransitionSchema = z.discriminatedUnion(
  "to",
  [
    // `to: "cancelled"` tách theo `from`: Báo thiếu hàng (confirmed) cố định lý do + cần productId,
    // Từ chối thì cần `reason` (Story 5.7). Cặp from/to có hợp lệ hay không do `transitionOrder` quyết định.
    z.discriminatedUnion(
      "from",
      [
        z.object({
          from: z.literal("confirmed"),
          to: z.literal("cancelled"),
          reason: z.literal("out_of_stock", { error: "Báo thiếu hàng chỉ dùng lý do Hết hàng" }),
          productId: z.string({ error: "Chọn món bị thiếu hàng" }).min(1, "Chọn món bị thiếu hàng"),
        }),
        z.object({
          from: z.enum(
            ORDER_STATUSES.filter((s) => s !== "confirmed"),
            { error: "Trạng thái hiện tại không hợp lệ" },
          ),
          to: z.literal("cancelled"),
          reason: z.enum(CANCEL_REASONS, { error: "Chọn một lý do hợp lệ" }),
        }),
      ],
      { error: "Trạng thái hiện tại không hợp lệ" },
    ),
    z.object({
      from: statusField("Trạng thái hiện tại"),
      to: z.enum(["pending", "confirmed", "shipping", "delivered"], {
        error: "Trạng thái đích không hợp lệ",
      }),
    }),
  ],
  { error: "Trạng thái đích không hợp lệ" },
);

export type StaffTransitionBody = z.infer<typeof staffTransitionSchema>;

/** Body POST /api/admin/orders/search. SĐT chỉ đi trong body, không có trường tiền hay tồn (AD-8). */
export const phoneSearchSchema = z.object({
  phone: z
    .string({ error: "Số điện thoại phải là chuỗi" })
    .trim()
    .max(32, "Số điện thoại tối đa 32 ký tự"),
});
