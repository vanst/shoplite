/** Chỗ duy nhất đọc IP client: phần tử ngoài cùng bên phải của x-forwarded-for (do proxy tin cậy nối), thiếu thì "direct". */
export function getClientKey(request: Request): string {
  const last = request.headers.get("x-forwarded-for")?.split(",").at(-1)?.trim();
  return last || "direct";
}
