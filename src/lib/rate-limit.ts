export interface RateLimiterOptions {
  max: number;
  windowMs: number;
  lockMs: number;
  maxKeys: number;
  now?: () => number;
}

export type RateLimitResult = { allowed: true } | { allowed: false; retryAfterSeconds: number };

interface Entry {
  count: number;
  windowStart: number;
  lockedUntil: number;
}

/** Giới hạn lần thử sai theo khóa: `max` lần sai trong `windowMs` thì khóa `lockMs`. Chỉ đếm lần sai. */
export function createRateLimiter(options: RateLimiterOptions) {
  const { max, windowMs, lockMs, maxKeys, now = Date.now } = options;
  const entries = new Map<string, Entry>(); // Map giữ thứ tự chèn nên khóa đầu tiên là cũ nhất

  const isLocked = (e: Entry, t: number) => e.lockedUntil > t;
  const isStale = (e: Entry, t: number) =>
    e.lockedUntil > 0 ? e.lockedUntil <= t : t - e.windowStart >= windowMs;
  const retryAfter = (until: number, t: number) => Math.max(1, Math.ceil((until - t) / 1000));

  /** Chừa chỗ cho khóa mới: loại khóa hết hạn trước, rồi khóa cũ nhất chưa bị khóa. */
  function makeRoom(t: number): boolean {
    if (entries.size < maxKeys) return true;
    for (const [key, e] of entries) if (isStale(e, t)) entries.delete(key);
    if (entries.size < maxKeys) return true;
    for (const [key, e] of entries) {
      if (!isLocked(e, t)) {
        entries.delete(key);
        return true;
      }
    }
    return false;
  }

  return {
    /** Không đổi bộ đếm. */
    check(key: string): RateLimitResult {
      const t = now();
      const entry = entries.get(key);
      if (entry && isLocked(entry, t)) {
        return { allowed: false, retryAfterSeconds: retryAfter(entry.lockedUntil, t) };
      }
      if (!entry && !makeRoom(t)) {
        // Mọi khóa đang bị khóa: từ chối khóa mới đến khi khóa sớm nhất hết hạn
        const soonest = Math.min(...[...entries.values()].map((e) => e.lockedUntil));
        return { allowed: false, retryAfterSeconds: retryAfter(soonest, t) };
      }
      return { allowed: true };
    },

    /** Ghi một lần sai; lần thứ `max` bắt đầu khóa. */
    recordFailure(key: string): void {
      const t = now();
      let entry = entries.get(key);
      if (entry && isStale(entry, t)) {
        entries.delete(key);
        entry = undefined;
      }
      if (entry && isLocked(entry, t)) return; // đang khóa thì không kéo dài thêm
      if (!entry) {
        if (!makeRoom(t)) return; // `check` đã chặn trường hợp này trước khi so mật khẩu
        entry = { count: 0, windowStart: t, lockedUntil: 0 };
        entries.set(key, entry);
      }
      entry.count += 1;
      if (entry.count >= max) entry.lockedUntil = t + lockMs;
    },
  };
}

export type RateLimiter = ReturnType<typeof createRateLimiter>;
