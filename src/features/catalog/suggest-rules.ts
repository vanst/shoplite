/** Hằng số và kiểu của gợi ý tìm kiếm. Thuần, không import dữ liệu: dùng được ở cả client và server. */

export const MIN_QUERY_LENGTH = 2;
export const MAX_QUERY_LENGTH = 50;
export const MAX_SUGGESTIONS = 5;

export interface Suggestion {
  slug: string;
  name: string;
  price: number;
  inStock: boolean;
}
