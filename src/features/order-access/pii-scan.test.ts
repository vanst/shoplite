// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createSessionCookie } from "@/features/admin/admin-guard";
import { POST as postOrders } from "@/app/api/orders/route";
import { POST as postLookup } from "@/app/api/orders/lookup/route";
import { GET, PATCH } from "@/app/api/orders/[id]/route";
import { GRANT_COOKIE_NAME } from "./order-grant";

let grantToken: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (grantToken ? { name, value: grantToken } : undefined),
  }),
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/features/orders/server", async () => {
  const { createOrderService } = await import("@/features/orders/order-service");
  const { createInMemoryOrderRepository } = await import("@/features/orders/order-repository");
  return { orderService: createOrderService({ repository: createInMemoryOrderRepository() }) };
});

import OrderDetailPage from "@/app/(shop)/orders/[id]/page";
import { renderToStaticMarkup } from "react-dom/server";

// Dữ liệu cá nhân đặc trưng: mọi chuỗi dưới đây không được xuất hiện trong bất kỳ response phía khách nào
const PII = [
  "0987001234",
  "+84987001234",
  "84987001234",
  "987001234",
  "khoa.tran@example.com",
  "88 Duong Hoa Sen Phuong Binh An",
  "Giao gio hanh chinh, goi truoc",
  "Trần Quốc Bảo Khoa",
];
const customer = {
  fullName: "Trần Quốc Bảo Khoa",
  phone: "0987001234",
  email: "khoa.tran@example.com",
  address: "88 Duong Hoa Sen Phuong Binh An",
  note: "Giao gio hanh chinh, goi truoc",
};
const orderBody = {
  customer,
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [{ productId: "p010", quantity: 1 }],
};

const clean = (label: string, text: string, headers?: Headers) => {
  const haystack = text + (headers ? [...headers].map(([k, v]) => `${k}: ${v}`).join("\n") : "");
  for (const value of PII) expect(haystack, `${label} lộ "${value}"`).not.toContain(value);
  expect(haystack, `${label} có khóa customer`).not.toMatch(/"customer"\s*:/);
};
const scan = async (label: string, response: Response) =>
  clean(label, await response.text(), response.headers);

let ip = 0;
const json = (url: string, init: RequestInit & { cookie?: string }) =>
  new Request(url, {
    ...init,
    headers: {
      ...(init.cookie ? { cookie: init.cookie } : {}),
      "x-forwarded-for": `10.9.9.${ip}`,
    },
  });
const params = (id: string) => ({ params: Promise.resolve({ id }) }) as never;
const render = async (id: string) =>
  renderToStaticMarkup(
    await OrderDetailPage({
      params: Promise.resolve({ id }),
      searchParams: Promise.resolve({}),
    } as Parameters<typeof OrderDetailPage>[0]),
  );

beforeEach(() => {
  ip++; // mỗi test một IP để khóa tra cứu không lan sang test khác
  grantToken = undefined;
  vi.stubEnv("ADMIN_PASSWORD", "mat-khau-test");
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

async function place() {
  const response = await postOrders(
    json("http://localhost/api/orders", { method: "POST", body: JSON.stringify(orderBody) }),
  );
  expect(response.status).toBe(201);
  const cookie = response.headers.get("set-cookie")!.split(";")[0];
  const text = await response.clone().text();
  clean("POST /api/orders 201", text, response.headers);
  return { id: JSON.parse(text).id as string, cookie };
}

describe("quét PII mọi response phía khách", () => {
  it("POST /api/orders: 201 và các lỗi (400 JSON hỏng, 422 validate, 404 sản phẩm)", async () => {
    await place();
    const bad = [
      "{oops",
      JSON.stringify({ ...orderBody, customer: { ...customer, phone: "0987001234x" } }),
      JSON.stringify({ ...orderBody, items: [{ productId: "khong-co", quantity: 1 }] }),
      JSON.stringify({ ...orderBody, couponCode: "KHONGCO" }),
    ];
    for (const body of bad) {
      const response = await postOrders(
        json("http://localhost/api/orders", { method: "POST", body }),
      );
      expect(response.status).toBeGreaterThanOrEqual(400);
      await scan("POST /api/orders lỗi", response);
    }
  });

  it("POST /api/orders/lookup: 200, 404, 400, 429", async () => {
    const { id } = await place();
    const call = (body: unknown) =>
      postLookup(
        json("http://localhost/api/orders/lookup", { method: "POST", body: JSON.stringify(body) }),
      );
    const ok = await call({ orderId: id, verification: "1234" });
    expect(ok.status).toBe(200);
    await scan("lookup 200", ok);
    const missing = await call({ orderId: id, verification: "0000" });
    expect(missing.status).toBe(404);
    await scan("lookup 404", missing);
    const invalid = await call({ orderId: id, verification: "12" });
    expect(invalid.status).toBe(400);
    await scan("lookup 400", invalid);
    for (let i = 0; i < 5; i++) await call({ orderId: `SL-X${i}`, verification: "0000" });
    const locked = await call({ orderId: id, verification: "1234" });
    expect(locked.status).toBe(429);
    await scan("lookup 429", locked);
  });

  it("GET /api/orders/:id: có grant (đúng và sai id) và không grant", async () => {
    const { id, cookie } = await place();
    const withGrant = await GET(
      json(`http://localhost/api/orders/${id}`, { method: "GET", cookie }),
      params(id),
    );
    expect(withGrant.status).toBe(200);
    await scan("GET có grant", withGrant);
    for (const [label, ck, target] of [
      ["GET không grant", undefined, id],
      ["GET grant sai id", cookie, "SL-KHONG-CO"],
    ] as const) {
      const response = await GET(
        json(`http://localhost/api/orders/${target}`, { method: "GET", cookie: ck }),
        params(target),
      );
      expect(response.status).toBe(401);
      await scan(label, response);
    }
  });

  it("PATCH /api/orders/:id: 200, 401, 409", async () => {
    const { id, cookie } = await place();
    const patch = (ck?: string) =>
      PATCH(
        json(`http://localhost/api/orders/${id}`, {
          method: "PATCH",
          cookie: ck,
          body: JSON.stringify({ status: "cancelled" }),
        }),
        params(id),
      );
    const unauthorized = await patch();
    expect(unauthorized.status).toBe(401);
    await scan("PATCH 401", unauthorized);
    const ok = await patch(cookie);
    expect(ok.status).toBe(200);
    await scan("PATCH 200", ok);
    const conflict = await patch(cookie);
    expect(conflict.status).toBe(409);
    await scan("PATCH 409", conflict);
  });

  it("phiên quản trị vẫn là đường duy nhất trả Order đầy đủ (đối chứng, không nằm trong quét)", async () => {
    const { id } = await place();
    const admin = createSessionCookie(new Request("http://localhost")).split(";")[0];
    const response = await GET(
      json(`http://localhost/api/orders/${id}`, { method: "GET", cookie: admin }),
      params(id),
    );
    expect((await response.json()).customer.phone).toBe(customer.phone);
  });
});

describe("trang /orders/[id]", () => {
  it("không chứa PII ở trường hợp có grant, không grant và grant hết hạn", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    const { id, cookie } = await place();
    const token = cookie.slice(GRANT_COOKIE_NAME.length + 1);

    grantToken = token;
    const granted = await render(id);
    expect(granted).toContain(id);
    clean("trang có grant", granted);

    grantToken = undefined;
    clean("trang không grant", await render(id));

    grantToken = token;
    vi.setSystemTime(Date.now() + 31 * 60 * 1000);
    const expired = await render(id);
    clean("trang grant hết hạn", expired);
    expect(expired).toContain("Tra cứu đơn hàng");
  });

  it("không grant: HTML giống nhau cho đơn tồn tại và không tồn tại", async () => {
    const { id } = await place();
    const other = id.replace(/.$/, id.endsWith("0") ? "1" : "0");
    expect((await render(id)).replaceAll(id, "X")).toBe(
      (await render(other)).replaceAll(other, "X"),
    );
  });
});
