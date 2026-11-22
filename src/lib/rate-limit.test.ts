import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

const MIN = 60_000;

function setup(maxKeys = 100, windowMs = 15 * MIN) {
  let t = 1_000_000;
  const limiter = createRateLimiter({
    max: 5,
    windowMs,
    lockMs: 15 * MIN,
    maxKeys,
    now: () => t,
  });
  return { limiter, advance: (ms: number) => (t += ms) };
}

function fail(limiter: ReturnType<typeof setup>["limiter"], key: string, times: number) {
  for (let i = 0; i < times; i++) limiter.recordFailure(key);
}

describe("createRateLimiter", () => {
  it("4 lần sai vẫn cho phép, lần thứ 5 mới khóa", () => {
    const { limiter } = setup();
    fail(limiter, "a", 4);
    expect(limiter.check("a")).toEqual({ allowed: true });
    fail(limiter, "a", 1);
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 900 });
  });

  it("check không tăng bộ đếm", () => {
    const { limiter } = setup();
    fail(limiter, "a", 4);
    for (let i = 0; i < 10; i++) limiter.check("a");
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("retryAfterSeconds làm tròn lên, tối thiểu 1", () => {
    const { limiter, advance } = setup();
    fail(limiter, "a", 5);
    advance(15 * MIN - 1500);
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 2 });
    advance(1499);
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 1 });
  });

  it("hết khóa thì thử lại được và bộ đếm bắt đầu lại", () => {
    const { limiter, advance } = setup();
    fail(limiter, "a", 5);
    advance(15 * MIN);
    expect(limiter.check("a").allowed).toBe(true);
    fail(limiter, "a", 4);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("quá cửa sổ thì bộ đếm bắt đầu lại", () => {
    const { limiter, advance } = setup();
    fail(limiter, "a", 4);
    advance(15 * MIN);
    fail(limiter, "a", 1);
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("khóa của IP A không ảnh hưởng IP B", () => {
    const { limiter } = setup();
    fail(limiter, "a", 5);
    expect(limiter.check("b").allowed).toBe(true);
  });

  it("bộ nhớ đầy thì loại khóa hết hạn trước, giữ khóa chưa hết hạn dù cũ hơn", () => {
    const { limiter, advance } = setup(3, 60 * MIN);
    fail(limiter, "fresh", 4); // cũ nhất, chưa khóa, cửa sổ còn hiệu lực
    fail(limiter, "expired", 5);
    fail(limiter, "filler", 2);
    advance(15 * MIN); // khóa của "expired" hết hạn
    expect(limiter.check("new").allowed).toBe(true);
    fail(limiter, "fresh", 1); // còn giữ đủ 4 lần sai nên lần này khóa
    expect(limiter.check("fresh").allowed).toBe(false);
  });

  it("lần sai ghi trong lúc đang khóa không làm đổi retryAfterSeconds", () => {
    const { limiter, advance } = setup();
    fail(limiter, "a", 5);
    advance(5 * MIN);
    fail(limiter, "a", 3);
    expect(limiter.check("a")).toEqual({ allowed: false, retryAfterSeconds: 600 });
  });

  it("bộ nhớ đầy thì loại khóa cũ nhất chưa bị khóa, không bao giờ loại khóa đang bị khóa", () => {
    const { limiter } = setup(3);
    fail(limiter, "locked", 5);
    fail(limiter, "p1", 2);
    fail(limiter, "p2", 2);
    fail(limiter, "new", 1); // loại p1
    expect(limiter.check("locked").allowed).toBe(false);
    fail(limiter, "p1", 4); // p1 phải bắt đầu lại từ 0 (loại p2 để chừa chỗ), chưa bị khóa
    expect(limiter.check("p1").allowed).toBe(true);
  });

  it("mọi khóa đang bị khóa thì từ chối khóa mới", () => {
    const { limiter } = setup(3);
    for (const key of ["a", "b", "c"]) fail(limiter, key, 5);
    expect(limiter.check("d")).toEqual({ allowed: false, retryAfterSeconds: 900 });
    expect(limiter.check("a").allowed).toBe(false);
  });
});
