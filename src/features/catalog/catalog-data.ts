import { categories } from "@/data/categories";
import { products } from "@/data/products";
import type { Category, Product } from "./types";

/** Tên báo hiệu `stock` ở đây là Tồn gốc (tĩnh); chỉ server được gọi, xem catalog-data-imports.test.ts. */
export function getCatalogProducts(): Product[] {
  return products;
}

export function getCategories(): Category[] {
  return categories;
}

export function getProductById(id: string): Product | undefined {
  return products.find((product) => product.id === id);
}
