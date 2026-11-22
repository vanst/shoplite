// Smoke AD-3: route handler và Server Component phải dùng chung một repository trong tiến trình.
// Chạy `next dev` rồi `next build` + `next start` với ORDERS_FILE tạm; POST /api/orders (nhận cookie grant)
// rồi GET /orders/{id} kèm cookie đó và phải thấy đúng mã đơn vừa tạo. Không nằm trong `npm run check` (chậm).
import { spawn, spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

const PORT = Number(process.env.SMOKE_PORT ?? 3210);
const DIST_DIR = ".next-smoke"; // tách khỏi `.next` để không đè bản build/dev đang dùng
const BASE = `http://127.0.0.1:${PORT}`;
const ORDER = {
  customer: { fullName: "Khách Smoke", phone: "0912345678", address: "1 Lê Lợi, Quận 1, TP.HCM" },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [{ productId: "p010", quantity: 1 }],
};

async function waitReady(server) {
  for (let i = 0; i < 120; i++) {
    if (server.exitCode !== null) throw new Error(`Server thoát sớm (mã ${server.exitCode})`);
    try {
      if ((await fetch(`${BASE}/api/products`)).ok) return;
    } catch {}
    await new Promise((r) => setTimeout(r, 1000));
  }
  throw new Error("Server không sẵn sàng sau 120 giây");
}

async function check(mode) {
  const dir = await mkdtemp(path.join(tmpdir(), "shoplite-smoke-"));
  const env = {
    ...process.env,
    PORT: String(PORT),
    ORDERS_FILE: path.join(dir, "orders.json"),
    NEXT_DIST_DIR: DIST_DIR,
    ADMIN_PASSWORD: "",
  };
  const server = spawn("npx", ["next", mode, "-p", String(PORT)], { env, stdio: "ignore" });
  try {
    await waitReady(server);
    const post = await fetch(`${BASE}/api/orders`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(ORDER),
    });
    if (post.status !== 201) throw new Error(`POST /api/orders trả ${post.status}`);
    const { id } = await post.json();
    const cookie = post.headers
      .getSetCookie()
      .map((c) => c.split(";")[0])
      .join("; ");
    if (!cookie) throw new Error("POST /api/orders không cấp cookie grant");
    const page = await fetch(`${BASE}/orders/${id}`, { headers: { cookie } });
    const html = await page.text();
    if (page.status !== 200 || !html.includes(id)) {
      throw new Error(`GET /orders/${id} (${page.status}) không thấy đơn vừa tạo`);
    }
    console.log(`OK next ${mode}: route handler và trang đơn dùng chung dữ liệu (${id})`);
  } finally {
    server.kill("SIGTERM");
    await new Promise((r) => setTimeout(r, 500));
    await rm(dir, { recursive: true, force: true });
  }
}

try {
  await check("dev");
  const build = spawnSync("npx", ["next", "build"], {
    stdio: "inherit",
    env: { ...process.env, NEXT_DIST_DIR: DIST_DIR, ADMIN_PASSWORD: "" },
  });
  if (build.status !== 0) throw new Error("next build lỗi");
  await check("start");
} catch (error) {
  console.error(String(error));
  process.exitCode = 1;
} finally {
  await rm(DIST_DIR, { recursive: true, force: true });
}
