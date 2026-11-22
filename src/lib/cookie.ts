export function readCookie(request: Request, name: string): string | undefined {
  for (const part of (request.headers.get("cookie") ?? "").split(";")) {
    const index = part.indexOf("=");
    if (index > 0 && part.slice(0, index).trim() === name) return part.slice(index + 1).trim();
  }
  return undefined;
}

// shortcut: tin phần tử đầu của x-forwarded-proto, chỉ đúng khi sau reverse proxy tin cậy
function isSecure(request: Request): boolean {
  const forwarded = request.headers.get("x-forwarded-proto")?.split(",")[0].trim().toLowerCase();
  return forwarded === "https" || new URL(request.url).protocol === "https:";
}

/** Giá trị Set-Cookie: HttpOnly, SameSite=Lax, Path=/, Secure theo giao thức thực. */
export function buildCookie(
  name: string,
  value: string,
  maxAgeSeconds: number,
  request: Request,
): string {
  const expires = new Date(maxAgeSeconds === 0 ? 0 : Date.now() + maxAgeSeconds * 1000);
  return [
    `${name}=${value}`,
    "Path=/",
    `Expires=${expires.toUTCString()}`,
    `Max-Age=${maxAgeSeconds}`,
    "HttpOnly",
    "SameSite=Lax",
    ...(isSecure(request) ? ["Secure"] : []),
  ].join("; ");
}
