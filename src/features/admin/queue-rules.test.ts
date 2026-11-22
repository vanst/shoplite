import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "@/features/orders/types";
import { ADMIN_TAB_BY_STATUS, formatPendingAge } from "./queue-rules";

const CREATED = "2026-10-21T00:00:00.000Z";
const after = (minutes: number) => new Date(Date.parse(CREATED) + minutes * 60_000);

describe("formatPendingAge", () => {
  it.each([
    [0, "Chờ 0 phút"],
    [1, "Chờ 1 phút"],
    [59, "Chờ 59 phút"],
    [60, "Chờ 1 giờ"],
    [23 * 60 + 59, "Chờ 23 giờ"],
    [24 * 60, "Chờ 1 ngày"],
    [25 * 60, "Chờ 1 ngày 1 giờ"],
    [48 * 60, "Chờ 2 ngày"],
    [49 * 60, "Chờ 2 ngày 1 giờ"],
  ])("sau %i phút: %s", (minutes, expected) => {
    expect(formatPendingAge(CREATED, after(minutes))).toBe(expected);
  });

  it("đồng hồ lệch (tạo sau now) không ra số âm", () => {
    expect(formatPendingAge(CREATED, after(-5))).toBe("Chờ 0 phút");
  });
});

describe("ADMIN_TAB_BY_STATUS", () => {
  it("phủ mọi trạng thái; delivered và cancelled về done", () => {
    expect(Object.keys(ADMIN_TAB_BY_STATUS).sort()).toEqual([...ORDER_STATUSES].sort());
    expect(ADMIN_TAB_BY_STATUS).toMatchObject({
      pending: "pending",
      confirmed: "confirmed",
      shipping: "shipping",
      delivered: "done",
      cancelled: "done",
    });
  });
});
