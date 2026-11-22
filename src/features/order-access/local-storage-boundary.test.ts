// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = path.join(process.cwd(), "src");
/** Ba nơi duy nhất ở production được truy cập localStorage (AGENTS.md). */
const ALLOWED = [
  "features/cart/cart-store.ts",
  "features/wishlist/wishlist-store.ts",
  "features/order-access/recent-orders-store.ts",
];

const withoutComments = (source: string) =>
  source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

describe("ranh giới localStorage", () => {
  it("chỉ ba store được dùng localStorage ở code production", () => {
    const users = (readdirSync(SRC_DIR, { recursive: true }) as string[])
      .map((file) => file.split(path.sep).join("/"))
      .filter((file) => /\.tsx?$/.test(file) && !/\.test\.tsx?$/.test(file))
      .filter((file) =>
        /\blocalStorage\b/.test(withoutComments(readFileSync(path.join(SRC_DIR, file), "utf8"))),
      );

    expect(users.sort()).toEqual([...ALLOWED].sort());
  });
});
