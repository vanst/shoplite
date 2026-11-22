import { singleton } from "@/lib/process-singleton";
import { createRateLimiter } from "@/lib/rate-limit";

const FIFTEEN_MINUTES = 15 * 60 * 1000;

/** Khóa có namespace `lookup-ip:` và `lookup-order:`; một tiến trình Node, mất khi khởi động lại. */
export const lookupLimiter = singleton("lookup-limiter", () =>
  createRateLimiter({
    max: 5,
    windowMs: FIFTEEN_MINUTES,
    lockMs: FIFTEEN_MINUTES,
    maxKeys: 10_000,
  }),
);
