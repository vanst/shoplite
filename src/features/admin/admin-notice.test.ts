import { describe, expect, it } from "vitest";
import { noticeUrl, parseNotice } from "./admin-notice";

const ID = "SL-20261021-ABC123";

describe("parseNotice", () => {
  it("rejected ra câu Đã từ chối đơn", () => {
    expect(parseNotice("rejected", ID)).toBe(`Đã từ chối đơn ${ID}`);
  });

  it("confirmed, shipping, delivered ra đúng câu", () => {
    expect(parseNotice("confirmed", ID)).toBe(`Đã xác nhận đơn ${ID}`);
    expect(parseNotice("shipping", ID)).toBe(`Đơn ${ID} đã chuyển sang Đang giao`);
    expect(parseNotice("delivered", ID)).toBe(`Đơn ${ID} đã chuyển sang Đã giao`);
  });

  it("shortage ra câu Đã báo thiếu hàng", () => {
    expect(parseNotice("shortage", ID)).toBe(`Đã báo thiếu hàng, đơn ${ID} bị từ chối`);
  });

  it("mã lạ, thiếu, mảng hoặc mã đơn sai dạng thì bỏ qua", () => {
    expect(parseNotice("hack", ID)).toBeUndefined();
    expect(parseNotice("confirmed", "<b>x</b>")).toBeUndefined();
    expect(parseNotice("confirmed", undefined)).toBeUndefined();
    expect(parseNotice(["confirmed"], ID)).toBeUndefined();
  });

  it("noticeUrl dựng URL hàng việc", () => {
    expect(noticeUrl("pending", "confirmed", ID)).toBe(
      `/admin?tab=pending&notice=confirmed&order=${ID}`,
    );
  });
});
