/** Giữ một instance duy nhất trên cả tiến trình, bền qua hot reload và các bundle của Next. */
export function singleton<T>(key: string, init: () => T): T {
  const store = globalThis as unknown as Record<symbol, T | undefined>;
  const id = Symbol.for(`shoplite:${key}`);
  store[id] ??= init();
  return store[id] as T;
}
