/** Chuẩn hóa SĐT về dạng `0…`: bỏ khoảng trắng, dấu chấm, gạch, ngoặc; `+84` ≡ `0`. */
export function normalizePhone(raw: string): string {
  const compact = raw.replace(/[\s.\-()]/g, "");
  return compact.startsWith("+84") ? `0${compact.slice(3)}` : compact;
}

/** Không khớp được Mã xác minh hợp lệ nào (Mã xác minh luôn là 4 chữ số). */
export const NO_PHONE_LAST4 = "----";

/** 4 chữ số cuối của SĐT; ít hơn 4 chữ số thì trả giá trị không bao giờ khớp. */
export function getPhoneLast4(phone: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, "");
  return digits.length < 4 ? NO_PHONE_LAST4 : digits.slice(-4);
}
