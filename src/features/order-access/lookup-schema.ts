import { z } from "zod";

/** Không có trường tiền hay tồn (AD-8). `verification` = 4 chữ số cuối SĐT. */
export const lookupSchema = z.object({
  orderId: z.string().trim().min(1, "Vui lòng nhập mã đơn hàng"),
  verification: z.string().regex(/^\d{4}$/, "Mã xác minh gồm 4 chữ số cuối số điện thoại"),
});

export type LookupInput = z.infer<typeof lookupSchema>;
