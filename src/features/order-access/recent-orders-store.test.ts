import { afterEach, describe, expect, it, vi } from "vitest";
import { addRecentOrder, readRecentOrders, RECENT_ORDERS_KEY } from "./recent-orders-store";

const id = (n: number) => `SL-20261021-00000${n}`;

afterEach(() => vi.restoreAllMocks());

describe("recent-orders-store", () => {
  it("ghi mới nhất trước, không trùng", () => {
    addRecentOrder(id(1));
    addRecentOrder(id(2));
    addRecentOrder(id(1));
    expect(readRecentOrders()).toEqual([id(1), id(2)]);
  });

  it("tối đa 5: đơn thứ 6 đẩy mã cũ nhất ra", () => {
    for (let n = 1; n <= 6; n++) addRecentOrder(id(n));
    expect(readRecentOrders()).toEqual([id(6), id(5), id(4), id(3), id(2)]);
  });

  it("chỉ lưu mảng mã đơn dưới key shoplite:recent-orders", () => {
    addRecentOrder(id(1));
    expect(localStorage.getItem(RECENT_ORDERS_KEY)).toBe(JSON.stringify([id(1)]));
    expect(RECENT_ORDERS_KEY).toBe("shoplite:recent-orders");
  });

  it("không ghi mã sai dạng", () => {
    addRecentOrder("abc");
    expect(readRecentOrders()).toEqual([]);
  });

  it("bỏ phần tử sai, dữ liệu hỏng hay không phải mảng mà không ném lỗi", () => {
    localStorage.setItem(RECENT_ORDERS_KEY, JSON.stringify([id(1), "x", 5, null, id(1)]));
    expect(readRecentOrders()).toEqual([id(1)]);
    localStorage.setItem(RECENT_ORDERS_KEY, "{hong");
    expect(readRecentOrders()).toEqual([]);
    localStorage.setItem(RECENT_ORDERS_KEY, '{"a":1}');
    expect(readRecentOrders()).toEqual([]);
  });

  it("localStorage ném lỗi thì đọc và ghi đều im lặng", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    expect(readRecentOrders()).toEqual([]);
    expect(() => addRecentOrder(id(1))).not.toThrow();
  });
});
