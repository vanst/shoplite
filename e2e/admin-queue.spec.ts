import { randomInt } from "node:crypto";
import { expect, test, type APIRequestContext, type Browser } from "@playwright/test";
import { ADMIN_TEST_PASSWORD, BASE_URL } from "../playwright.config";

test("Hàng việc: đơn mới ở tab Chờ xác nhận, đổi tab, Làm mới", async ({ browser }) => {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
    },
  });
  const placed = await context.request.post("/api/orders", {
    data: {
      customer: { fullName: "Phạm Hàng Việc", phone: "0912345678", address: "5 Nguyễn Huệ Quận 1" },
      shippingMethod: "standard",
      paymentMethod: "cod",
      items: [{ productId: "p010", quantity: 2 }],
    },
  });
  const { id } = await placed.json();
  await context.request.post("/api/admin/login", { data: { password: ADMIN_TEST_PASSWORD } });

  const page = await context.newPage();
  await page.goto("/admin");
  await expect(page.getByTestId("admin-tab-pending")).toHaveAttribute("aria-current", "page");
  const row = page.getByTestId("admin-order-row").filter({ hasText: id });
  await expect(row).toContainText("Phạm Hàng Việc · 2 sản phẩm");
  await expect(row.getByRole("link", { name: id })).toHaveAttribute("href", `/admin/orders/${id}`);

  await page.getByTestId("admin-tab-shipping").click();
  await expect(page).toHaveURL(/tab=shipping/);
  await expect(page.getByTestId("admin-tab-shipping")).toHaveAttribute("aria-current", "page");

  await page.getByTestId("admin-refresh").click();
  await expect(page.getByTestId("status-notice")).toHaveText("Đã làm mới danh sách");
  await expect(page.getByTestId("status-notice")).toBeFocused();
  await context.close();
});

test("UJ-1: Xác nhận đơn từ chi tiết, kho giảm; đơn khác hết hàng bị khóa nút", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
    },
  });
  const place = async (quantity: number) => {
    const response = await context.request.post("/api/orders", {
      data: {
        customer: { fullName: "Võ Xác Nhận", phone: "0912345678", address: "7 Lê Lợi Quận 1" },
        shippingMethod: "standard",
        paymentMethod: "cod",
        items: [{ productId: "p011", quantity }],
      },
    });
    return (await response.json()).id as string;
  };
  // Tồn p011 giảm dần qua các lần chạy (file đơn tạm giữ lại), nên lấy tồn hiện tại làm số đặt.
  const { stock } = await (await context.request.get("/api/products/gia-do-laptop-nhom")).json();
  test.skip(
    stock < 1,
    "p011 đã hết tồn từ lần chạy trước: xóa shoplite-e2e-orders.json trong thư mục tạm",
  );
  const first = await place(stock);
  const second = await place(1);
  await context.request.post("/api/admin/login", { data: { password: ADMIN_TEST_PASSWORD } });

  const page = await context.newPage();
  await page.goto("/admin?tab=pending");
  const before = Number(
    await page
      .getByTestId("admin-tab-pending")
      .getByTestId("admin-tab-count")
      .innerText()
      .then((t) => t.match(/\d+/)![0]),
  );
  await page.getByTestId("admin-order-row").filter({ hasText: first }).getByRole("link").click();
  await expect(page.getByTestId("stock-current")).toHaveText(String(stock));
  await expect(page.getByTestId("stock-pending")).toHaveText("1"); // đơn `second`
  await page.getByTestId("confirm-order-button").click();

  await expect(page).toHaveURL(/\/admin\?tab=pending$/);
  const notice = page.getByTestId("status-notice");
  await expect(notice).toHaveText(`Đã xác nhận đơn ${first}`);
  await expect(notice).toBeFocused();
  await expect(page.getByTestId("admin-tab-pending").getByTestId("admin-tab-count")).toContainText(
    String(before - 1),
  );
  await page.reload();
  await expect(page.getByTestId("status-notice")).toHaveCount(0);

  await page.goto("/products/gia-do-laptop-nhom");
  await expect(page.getByText("Hết hàng").first()).toBeVisible();

  await page.goto(`/admin/orders/${second}`);
  await expect(page.getByTestId("stock-short")).toBeVisible();
  const button = page.getByTestId("confirm-order-button");
  await expect(button).toHaveAttribute("aria-disabled", "true");
  await expect(page.getByText("Có món không đủ hàng, chỉ có thể từ chối đơn.")).toBeVisible();

  // UJ-1 edge: Từ chối vì hết hàng
  await page.getByTestId("reject-order-button").click();
  await page.getByRole("radio", { name: "Hết hàng" }).check({ force: true });
  await page.getByTestId("reject-submit").click();
  await expect(page).toHaveURL(/\/admin\?tab=pending$/);
  await expect(page.getByTestId("status-notice")).toHaveText(`Đã từ chối đơn ${second}`);
  await page.getByTestId("admin-tab-done").click();
  await expect(page.getByTestId("admin-order-row").filter({ hasText: second })).toBeVisible();
  await context.close();
});

async function staffContext(browser: Browser) {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
    },
  });
  await context.request.post("/api/admin/login", { data: { password: ADMIN_TEST_PASSWORD } });
  return context;
}

async function placeP010(request: APIRequestContext) {
  const response = await request.post("/api/orders", {
    data: {
      customer: { fullName: "Đỗ Đang Giao", phone: "0912345678", address: "9 Hai Bà Trưng Quận 1" },
      shippingMethod: "standard",
      paymentMethod: "cod",
      items: [{ productId: "p010", quantity: 1 }],
    },
  });
  return (await response.json()).id as string;
}

const step = (request: APIRequestContext, id: string, from: string, to: string) =>
  request.patch(`/api/admin/orders/${id}`, { data: { from, to } });

test("UJ-2: Hùng chuyển Đang giao rồi Đã giao, đơn sang tab Đã xong", async ({ browser }) => {
  const lan = await staffContext(browser);
  const hung = await staffContext(browser);
  const id = await placeP010(lan.request);
  expect((await step(lan.request, id, "pending", "confirmed")).status()).toBe(200);

  const page = await hung.newPage();
  await page.goto("/admin?tab=confirmed");
  const row = page.getByTestId("admin-order-row").filter({ hasText: id });
  await row.getByRole("button", { name: `Bắt đầu giao đơn ${id}` }).click();
  const notice = page.getByTestId("status-notice");
  await expect(notice).toHaveText(`Đơn ${id} đã chuyển sang Đang giao`);
  await expect(notice).toBeFocused();
  await expect(row).toHaveCount(0);

  await page.getByTestId("admin-tab-shipping").click();
  await page
    .getByTestId("admin-order-row")
    .filter({ hasText: id })
    .getByRole("button", { name: `Đã giao xong đơn ${id}` })
    .click();
  await expect(page.getByTestId("status-notice")).toHaveText(`Đơn ${id} đã chuyển sang Đã giao`);

  await page.getByTestId("admin-tab-done").click();
  await expect(page.getByTestId("admin-order-row").filter({ hasText: id })).toContainText(
    "Đã giao",
  );
  await lan.close();
  await hung.close();
});

test("UJ-2 xung đột: trang cũ bấm sau khi đơn đã đổi thì nhận 'Đơn đã được cập nhật ở nơi khác'", async ({
  browser,
}) => {
  const lan = await staffContext(browser);
  const hung = await staffContext(browser);
  const id = await placeP010(lan.request);
  await step(lan.request, id, "pending", "confirmed");

  const stale = await hung.newPage();
  await stale.goto("/admin?tab=confirmed");
  await expect(stale.getByTestId("admin-order-row").filter({ hasText: id })).toBeVisible();
  await step(lan.request, id, "confirmed", "shipping");

  await stale.getByRole("button", { name: `Bắt đầu giao đơn ${id}` }).click();
  const banner = stale.getByTestId("conflict-banner");
  await expect(banner).toHaveText("Đơn đã được cập nhật ở nơi khác");
  await expect(banner).toBeFocused();
  await expect(stale.getByTestId("admin-order-row").filter({ hasText: id })).toHaveCount(0);

  // Xác nhận từ màn chi tiết cũ khi đơn đã được xác nhận ở nơi khác
  const pendingId = await placeP010(lan.request);
  const detail = await hung.newPage();
  await detail.goto(`/admin/orders/${pendingId}`);
  await step(lan.request, pendingId, "pending", "confirmed");
  await detail.getByTestId("confirm-order-button").click();
  await expect(detail.getByTestId("conflict-banner")).toHaveText("Đơn đã được cập nhật ở nơi khác");
  await expect(detail.getByTestId("confirm-order-button")).toHaveCount(0);
  await expect(detail.getByTestId("step-button")).toBeVisible();
  await lan.close();
  await hung.close();
});

test("UJ-2 edge 2: Báo thiếu hàng ở đơn confirmed, đơn bị từ chối kèm Điều chỉnh tồn", async ({
  browser,
}) => {
  const hung = await staffContext(browser);
  const id = await placeP010(hung.request);
  expect((await step(hung.request, id, "pending", "confirmed")).status()).toBe(200);

  const page = await hung.newPage();
  await page.goto(`/admin/orders/${id}`);
  await page.getByTestId("shortage-report-button").click();
  await page.getByTestId("shortage-confirm").click();

  await expect(page).toHaveURL(/\/admin\?tab=confirmed$/);
  const notice = page.getByTestId("status-notice");
  await expect(notice).toHaveText(`Đã báo thiếu hàng, đơn ${id} bị từ chối`);
  await expect(notice).toBeFocused();

  const saved = await (await hung.request.get(`/api/orders/${id}`)).json();
  expect(saved).toMatchObject({
    status: "cancelled",
    cancelledBy: "staff",
    cancelReason: "out_of_stock",
    stockAdjustment: { productId: "p010", quantity: 1 },
  });
  await page.getByTestId("admin-tab-done").click();
  await expect(page.getByTestId("admin-order-row").filter({ hasText: id })).toBeVisible();
  await hung.close();
});
