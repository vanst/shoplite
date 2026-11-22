import { normalizeText } from "@/lib/format";
import { MAX_SUGGESTIONS, type Suggestion } from "./suggest-rules";
import type { Product } from "./types";

/**
 * Gợi ý sản phẩm khi khách đang gõ ở ô tìm kiếm: khớp theo tên và thương hiệu, không dấu.
 * Từ khóa là dữ liệu của khách nên chỉ so khớp bằng `includes`, không dựng RegExp.
 * `products` phải là sản phẩm đã phủ Tồn hiện tại (xem `inventoryService`).
 * Thứ tự: còn hàng trước; trong nhóm, điểm cao trước; bằng điểm thì nhiều lượt đánh giá trước.
 */
export function getSuggestions(query: string, products: readonly Product[]): Suggestion[] {
  const keyword = normalizeText(query);
  if (!keyword) return [];

  return products
    .filter((product) => normalizeText(`${product.name} ${product.brand}`).includes(keyword))
    .toSorted(
      (a, b) =>
        Number(b.stock > 0) - Number(a.stock > 0) ||
        b.rating - a.rating ||
        b.reviewCount - a.reviewCount,
    )
    .slice(0, MAX_SUGGESTIONS)
    .map((product) => ({
      slug: product.slug,
      name: product.name,
      price: product.price,
      inStock: product.stock > 0,
    }));
}
