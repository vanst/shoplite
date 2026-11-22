// @vitest-environment node
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC_DIR = path.join(process.cwd(), "src");
const GUARD_FILE = "features/admin/admin-guard.ts";

function listFiles(dir: string, match: RegExp): string[] {
  if (!existsSync(dir)) return [];
  return (readdirSync(dir, { recursive: true }) as string[])
    .filter((file) => match.test(file.split(path.sep).join("/")))
    .map((file) => path.join(dir, file));
}

/** Hai dòng đầu của thân hàm khớp `header` (bỏ khoảng trắng đầu dòng, nối bằng "\n"). */
function firstStatements(source: string, header: RegExp): string[] {
  const pattern = new RegExp(
    `${header.source}\\([^)]*\\)[^{]*\\{\\s*([^\\n]+)(?:\\n\\s*([^\\n]*))?`,
    "g",
  );
  return [...source.matchAll(pattern)].map((m) => `${m[1].trim()}\n${(m[2] ?? "").trim()}`);
}

const API_HANDLER = /export (?:async )?function (?:GET|POST|PUT|PATCH|DELETE)/;
const GUARD_CALL = /^const (\w+) = await requireAdminApi\([^)]*\);\n/;

/** Handler API phải gọi guard rồi trả ngay nếu kết quả là Response; login chỉ cần cổng cấu hình. */
function apiGuardViolations(name: string, source: string, isLogin: boolean): string[] {
  const heads = firstStatements(source, API_HANDLER);
  if (heads.length === 0) return [`${name}: không tìm thấy handler`];
  const ok = heads.every((head) => {
    if (isLogin) return /^const gate = adminGate\(\);\nif \(gate\) return gate;/.test(head);
    const match = GUARD_CALL.exec(head);
    return (
      match !== null && head.endsWith(`if (${match[1]} instanceof Response) return ${match[1]};`)
    );
  });
  return ok ? [] : [`${name}: thiếu guard ở dòng đầu`];
}

describe("chốt chặn khu vực quản trị", () => {
  it("mỗi page /admin/** gọi guard ở dòng đầu và là force-dynamic", () => {
    const pages = listFiles(path.join(SRC_DIR, "app/admin"), /(^|\/)page\.tsx$/);
    expect(pages.length).toBeGreaterThan(0);

    const violations = pages.flatMap((file) => {
      const source = readFileSync(file, "utf8");
      const name = path.relative(process.cwd(), file);
      const isLogin = name === path.join("src", "app", "admin", "login", "page.tsx");
      const guard = isLogin ? /^assertAdminEnabled\(/ : /^(const \w+ = )?(await\s+)?requireAdmin\(/;
      const heads = firstStatements(source, /export default (?:async )?function \w+/);
      return [
        ...(heads.length === 1 && guard.test(heads[0]) ? [] : [`${name}: thiếu guard ở dòng đầu`]),
        ...(/export const dynamic = "force-dynamic"/.test(source)
          ? []
          : [`${name}: thiếu force-dynamic`]),
      ];
    });

    expect(violations).toEqual([]);
  });

  it("mỗi handler /api/admin/** gọi requireAdminApi rồi trả Response nếu bị từ chối", () => {
    const routes = listFiles(path.join(SRC_DIR, "app/api/admin"), /(^|\/)route\.ts$/);
    expect(routes.length).toBeGreaterThan(0);
    // Route tìm SĐT (Story 6.1) phải nằm trong phạm vi quét
    expect(routes.map((r) => r.split(path.sep).join("/"))).toContainEqual(
      expect.stringContaining("api/admin/orders/search/route.ts"),
    );

    const violations = routes.flatMap((file) => {
      const name = path.relative(process.cwd(), file);
      const isLogin = name === path.join("src", "app", "api", "admin", "login", "route.ts");
      return apiGuardViolations(name, readFileSync(file, "utf8"), isLogin);
    });

    expect(violations).toEqual([]);
  });

  it("GET /api/orders (danh sách đơn đầy đủ) gọi guard ở dòng đầu", () => {
    const source = readFileSync(path.join(SRC_DIR, "app/api/orders/route.ts"), "utf8");
    const [head] = firstStatements(source, /export (?:async )?function GET/);
    const match = GUARD_CALL.exec(head ?? "");
    expect(match).not.toBeNull();
    expect(head).toContain(`if (${match![1]} instanceof Response) return ${match![1]};`);
  });

  it("bắt handler bỏ qua kết quả requireAdminApi và nêu tên file", () => {
    const bad =
      "export async function POST(request: Request) {\n  await requireAdminApi(request);\n  return x;\n}";
    const good =
      "export async function POST(request: Request) {\n  const ctx = await requireAdminApi(request);\n  if (ctx instanceof Response) return ctx;\n}";
    expect(apiGuardViolations("src/app/api/admin/x/route.ts", bad, false)).toEqual([
      "src/app/api/admin/x/route.ts: thiếu guard ở dòng đầu",
    ]);
    expect(apiGuardViolations("x", good, false)).toEqual([]);
  });

  it("chỉ admin-guard.ts đọc biến mật khẩu quản trị", () => {
    const readers = listFiles(SRC_DIR, /\.tsx?$/)
      .filter((file) => !/\.test\.tsx?$/.test(file))
      .filter((file) => readFileSync(file, "utf8").includes("ADMIN_PASSWORD"))
      .map((file) => path.relative(SRC_DIR, file).split(path.sep).join("/"));

    expect(readers).toEqual([GUARD_FILE]);
  });
});
