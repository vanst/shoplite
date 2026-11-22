const DEFAULT_NEXT = "/admin";

/** Chỉ nhận đường dẫn nội bộ trong /admin (không có "//"), ngược lại về /admin: chặn open redirect. */
export function sanitizeNext(raw?: string): string {
  if (!raw || raw.includes("//") || !/^\/admin(\/|$)/.test(raw)) return DEFAULT_NEXT;
  return raw;
}
