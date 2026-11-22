// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = path.join(process.cwd(), "src");

/** Module chỉ được dùng phía server: import vào Client Component sẽ lộ danh sách mã / dùng node:fs. */
const SERVER_ONLY_MODULES = [
  "@/features/admin/admin-guard",
  "@/data/coupons",
  "@/data/products",
  "@/features/catalog/catalog-data",
  "@/features/coupons/coupon-service",
  "@/features/orders/server",
  "@/features/inventory/server",
  "@/features/order-access/order-grant",
  "@/features/order-access/verify-lookup",
  "@/features/order-access/lookup-limiter",
  "@/features/orders/order-service",
];

function listSourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listSourceFiles(fullPath);
    return /\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [fullPath] : [];
  });
}

/** Import giá trị (bỏ `import type`, vì kiểu bị xóa lúc biên dịch). */
function importsOf(source: string): string[] {
  const withoutTypeImports = source.replace(/import\s+type\s[\s\S]*?from\s+["'][^"']+["'];?/g, "");
  return [...withoutTypeImports.matchAll(/from\s+["']([^"']+)["']/g)].map((match) => match[1]);
}

/** Đường dẫn file nguồn ứng với một alias `@/...`, nếu có trong src. */
function resolveAlias(alias: string): string | undefined {
  if (!alias.startsWith("@/")) return undefined;
  const base = path.join(SRC_DIR, alias.slice(2));
  return [".ts", ".tsx", "/index.ts", "/index.tsx"].map((ext) => base + ext).find(existsSync);
}

/** Nguồn đồ thị import: tên file → các specifier giá trị; tách ra để test bằng đồ thị giả. */
interface ImportGraph {
  imports(file: string): string[];
  resolve(file: string, specifier: string): string | undefined;
}

const realGraph: ImportGraph = {
  imports: (file) => importsOf(readFileSync(file, "utf8")),
  resolve: (file, specifier) => resolveAlias(toAlias(file, specifier)),
};

const isForbidden = (alias: string) =>
  SERVER_ONLY_MODULES.includes(alias) || alias.startsWith("node:");

/** Chuỗi import từ `file` tới từng module cấm chạm được (kể cả bắc cầu), mỗi phần tử dạng "a → b → module". */
function forbiddenChains(
  file: string,
  graph: ImportGraph = realGraph,
  label: (file: string) => string = (f) => path.relative(SRC_DIR, f),
  seen = new Set<string>(),
  trail: string[] = [],
): string[] {
  if (seen.has(file)) return [];
  seen.add(file);
  const here = [...trail, label(file)];
  return graph.imports(file).flatMap((specifier) => {
    const alias = toAlias(file, specifier);
    if (isForbidden(alias)) return [[...here, alias].join(" → ")];
    const next = graph.resolve(file, specifier);
    return next ? forbiddenChains(next, graph, label, seen, here) : [];
  });
}

/** Chuyển import tương đối ("../coupon-service") về dạng alias ("@/features/coupons/coupon-service"). */
function toAlias(file: string, specifier: string): string {
  if (!specifier.startsWith(".")) return specifier;
  const resolved = path.relative(SRC_DIR, path.resolve(path.dirname(file), specifier));
  return `@/${resolved.split(path.sep).join("/")}`;
}

describe("ranh giới client/server", () => {
  const clientFiles = listSourceFiles(SRC_DIR).filter((file) =>
    /^\s*["']use client["']/.test(readFileSync(file, "utf8")),
  );

  it("tìm thấy các Client Component để kiểm tra", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
    expect(clientFiles.some((file) => file.endsWith("coupon-field.tsx"))).toBe(true);
  });

  it("Client Component không import (kể cả bắc cầu) module server-only hay node:*", () => {
    expect(clientFiles.flatMap((file) => forbiddenChains(file))).toEqual([]);
  });

  it("forbiddenChains bắt được import gián tiếp trong đồ thị giả, kèm chuỗi import", () => {
    const edges: Record<string, string[]> = {
      "client.tsx": ["./a"],
      a: ["./b"],
      b: ["@/features/orders/server", "node:fs"],
      "safe.tsx": ["./c"],
      c: [],
    };
    const fake: ImportGraph = {
      imports: (file) => edges[file] ?? [],
      resolve: (file, specifier) => (specifier.startsWith("./") ? specifier.slice(2) : undefined),
    };
    const id = (file: string) => file;
    expect(forbiddenChains("client.tsx", fake, id)).toEqual([
      "client.tsx → a → b → @/features/orders/server",
      "client.tsx → a → b → node:fs",
    ]);
    expect(forbiddenChains("safe.tsx", fake, id)).toEqual([]);
  });
});
