import { describe, expect, it } from "vitest";
import { getCatalogProducts } from "./catalog-data";
import { MAX_SUGGESTIONS } from "./suggest-rules";
import { getSuggestions } from "./suggest-service";

const products = getCatalogProducts();
const names = (query: string) => getSuggestions(query, products).map((s) => s.name);

describe("getSuggestions", () => {
  it("khớp không dấu: 'ban phim' ra đúng Bàn phím cơ KeyPro 75%", () => {
    expect(getSuggestions("ban phim", products)).toEqual([
      expect.objectContaining({ name: "Bàn phím cơ KeyPro 75%", price: 1_890_000, inStock: true }),
    ]);
  });

  it("còn hàng xếp trước, hết hàng xếp sau (q=usb)", () => {
    const result = getSuggestions("usb", products);
    expect(result.map((s) => s.name)).toEqual(["Cáp USB-C bện dù 2m", "Micro thu âm PodCast USB"]);
    expect(result.map((s) => s.inStock)).toEqual([true, false]);
    expect(result[0].price).toBe(150_000);
    expect(result[1].price).toBe(1_150_000);
  });

  it("cùng 4,5 điểm: còn hàng trước hết hàng (q=po)", () => {
    expect(names("po")).toEqual(["Pin dự phòng PowerGo 20.000mAh", "Micro thu âm PodCast USB"]);
  });

  it("nhiều hơn 5 sản phẩm khớp thì chỉ trả đúng 5, theo thứ tự (q=on)", () => {
    const result = names("on");
    expect(result).toHaveLength(MAX_SUGGESTIONS);
    const thuTuSpec = ["StudioOne", "FitWatch S2", "SoundMax Pro", "PowerGo", "SwiftClick"];
    expect(thuTuSpec.map((tu) => result.find((name) => name.includes(tu)))).toEqual(result);
  });

  it("không có kết quả thì trả mảng rỗng (q=xyz)", () => {
    expect(getSuggestions("xyz", products)).toEqual([]);
  });

  it("ký tự đặc biệt là chữ thường, không ném lỗi và trả ngay", () => {
    for (const query of ["tai(", "(.*.*)*!", "a+b", "[", "\\", ".*"]) {
      const start = performance.now();
      expect(getSuggestions(query, products)).toEqual([]);
      expect(performance.now() - start).toBeLessThan(100);
    }
  });

  it("từ khóa rỗng sau khi chuẩn hóa thì không khớp gì", () => {
    expect(getSuggestions("   ", products)).toEqual([]);
  });

  it("không sửa mảng đầu vào", () => {
    const before = products.map((p) => p.id);
    getSuggestions("on", products);
    expect(products.map((p) => p.id)).toEqual(before);
  });
});
