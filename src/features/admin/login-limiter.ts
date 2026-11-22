import { singleton } from "@/lib/process-singleton";
import { createRateLimiter } from "@/lib/rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Giới hạn đăng nhập sai theo IP; bền qua hot reload. Một tiến trình Node, mất khi khởi động lại. */
export const loginLimiter = singleton("login-limiter", () =>
  createRateLimiter({
    max: 5,
    windowMs: FIFTEEN_MINUTES,
    lockMs: FIFTEEN_MINUTES,
    maxKeys: 10_000,
  }),
);
