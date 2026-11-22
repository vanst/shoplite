// Build rồi kiểm: cây /admin phải động và mật khẩu E2E không lọt vào bundle client hay HTML prerender.
import { spawnSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";

const NEXT_DIR = ".next";
const errors = [];

// Mật khẩu E2E đọc từ playwright.config.ts để không nhân đôi giá trị; thiếu thì dừng ngay
const config = readFileSync("playwright.config.ts", "utf8");
const password = config.match(/ADMIN_TEST_PASSWORD\s*=\s*"([^"]+)"/)?.[1];
if (!password) {
  console.error("Không đọc được ADMIN_TEST_PASSWORD từ playwright.config.ts");
  process.exit(1);
}

// Build với mật khẩu được đặt, để nếu nó rò vào output thì quét mới bắt được
// `--skip-build`: chỉ kiểm bản build có sẵn (để thử cố tình nhét mật khẩu vào `.next/static`)
if (!process.argv.includes("--skip-build")) {
  const env = { ...process.env, ADMIN_PASSWORD: password };
  delete env.NEXT_DIST_DIR; // script quét `.next`, không phải thư mục build của server E2E
  const build = spawnSync("npx", ["next", "build"], { stdio: "inherit", env });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

// 1. Không route /admin* nào được prerender tĩnh
const manifest = JSON.parse(readFileSync(path.join(NEXT_DIR, "prerender-manifest.json"), "utf8"));
const prerendered = [
  ...Object.keys(manifest.routes ?? {}),
  ...Object.keys(manifest.dynamicRoutes ?? {}),
];
for (const route of prerendered.filter((r) => r.startsWith("/admin"))) {
  errors.push(`Route quản trị bị prerender tĩnh: ${route}`);
}

// 2. Mật khẩu không có trong bundle client (.next/static) lẫn output prerender (.next/server/app)
const scan = (dir) => {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) scan(file);
    else if (readFileSync(file).includes(password))
      errors.push(`Mật khẩu test lọt vào output build: ${file}`);
  }
};
scan(path.join(NEXT_DIR, "static"));
scan(path.join(NEXT_DIR, "server", "app"));

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}
console.log(
  `Bản build đạt: ${prerendered.length} route prerender, không có /admin*, static và prerender sạch.`,
);
