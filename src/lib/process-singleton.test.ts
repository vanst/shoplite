import { afterEach, describe, expect, it, vi } from "vitest";
import { singleton } from "./process-singleton";

const KEYS = ["test-a", "test-b"];

afterEach(() => {
  for (const key of KEYS)
    delete (globalThis as Record<symbol, unknown>)[Symbol.for(`shoplite:${key}`)];
});

describe("singleton", () => {
  it("hai lần gọi cùng key trả cùng instance và init chỉ chạy một lần", () => {
    const init = vi.fn(() => ({}));
    expect(singleton("test-a", init)).toBe(singleton("test-a", init));
    expect(init).toHaveBeenCalledTimes(1);
  });

  it("nạp lại module vẫn trả instance cũ", async () => {
    const first = singleton("test-a", () => ({}));
    vi.resetModules();
    const reloaded = await import("./process-singleton");
    const init = vi.fn(() => ({}));
    expect(reloaded.singleton("test-a", init)).toBe(first);
    expect(init).not.toHaveBeenCalled();
  });

  it("key khác thì instance khác", () => {
    expect(singleton("test-a", () => ({}))).not.toBe(singleton("test-b", () => ({})));
  });
});
