// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = path.join(process.cwd(), "src");

/** Nơi được import `catalog-data` (Tồn gốc). Thêm vào đây phải có chủ đích. */
const ALLOWED = [
  "features/inventory/inventory-service.ts",
  "features/inventory/server.ts", // Tồn gốc cho GET /api/stock
  "features/orders/order-service.ts", // findProduct
  "features/coupons/coupon-service.ts", // chỉ lấy giá
  // Trang chỉ cần danh mục (không đọc stock); sản phẩm đi qua inventoryService.
  "app/(shop)/page.tsx",
  "app/(shop)/products/page.tsx",
  "app/(shop)/products/[slug]/page.tsx",
  "app/api/products/route.ts",
];

function listFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFiles(full);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe("nguồn Tồn gốc", () => {
  it("chỉ các file trong danh sách cho phép import catalog-data", () => {
    const found = listFiles(SRC_DIR)
      .filter((file) =>
        /from\s+["'](@\/features\/catalog\/|\.\/)catalog-data["']/.test(readFileSync(file, "utf8")),
      )
      .map((file) => path.relative(SRC_DIR, file).split(path.sep).join("/"))
      .filter((file) => file !== "features/catalog/catalog-data.ts");
    expect(found.filter((file) => !ALLOWED.includes(file))).toEqual([]);
  });

  it("trang khách và API sản phẩm render theo request, không đọc Tồn gốc trực tiếp", () => {
    const surfaces = [
      "app/(shop)/page.tsx",
      "app/(shop)/products/page.tsx",
      "app/(shop)/products/[slug]/page.tsx",
      "app/(shop)/wishlist/page.tsx",
      "app/api/products/route.ts",
      "app/api/products/[slug]/route.ts",
    ];
    for (const file of surfaces) {
      const source = readFileSync(path.join(SRC_DIR, file), "utf8");
      expect(source, file).toContain('export const dynamic = "force-dynamic"');
      expect(source, file).not.toContain("getCatalogProducts");
      expect(source, file).not.toContain("generateStaticParams");
      expect(source, file).not.toContain("revalidate");
    }
  });

  it("catalog-rules thuần, không import @/data/*", () => {
    const source = readFileSync(path.join(SRC_DIR, "features/catalog/catalog-rules.ts"), "utf8");
    expect(source).not.toMatch(/from\s+["']@\/data\//);
  });
});
