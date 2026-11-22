import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ADMIN_TEST_PASSWORD, BASE_URL } from "../playwright.config";

test("nhân viên mở chi tiết đơn đủ PII, PATCH Xác nhận qua API; chưa đăng nhập bị chặn", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
    },
  });
  const placed = await context.request.post("/api/orders", {
    data: {
      customer: {
        fullName: "Lê Thị Chi Tiết",
        phone: "0912345678",
        address: "5 Nguyễn Huệ Quận 1 TP HCM",
      },
      shippingMethod: "standard",
      paymentMethod: "cod",
      items: [{ productId: "p010", quantity: 1 }],
    },
  });
  const { id } = await placed.json();
  const url = `/api/admin/orders/${id}`;
  const confirm = { from: "pending", to: "confirmed" };

  expect((await context.request.patch(url, { data: confirm })).status()).toBe(401);

  const page = await context.newPage();
  await page.goto(`/admin/orders/${id}`);
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin%2Forders%2F/);

  expect(
    (
      await context.request.post("/api/admin/login", { data: { password: ADMIN_TEST_PASSWORD } })
    ).status(),
  ).toBe(204);
  await page.goto(`/admin/orders/${id}`);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(`Đơn hàng ${id}`);
  await expect(page).toHaveTitle(new RegExp(`^Đơn hàng ${id} · Quản trị`));
  await expect(page.getByTestId("admin-recipient")).toContainText("Lê Thị Chi Tiết");
  await expect(page.getByRole("link", { name: "0912345678" })).toHaveAttribute(
    "href",
    "tel:0912345678",
  );

  const ok = await context.request.patch(url, { data: confirm });
  expect(ok.status()).toBe(200);
  expect((await ok.json()).status).toBe("confirmed");
  const stale = await context.request.patch(url, { data: confirm });
  expect(stale.status()).toBe(409);
  expect((await stale.json()).error.code).toBe("ORDER_STATUS_CONFLICT");

  await page.reload();
  await expect(page.getByRole("link", { name: "Hàng việc" })).toHaveAttribute(
    "href",
    "/admin?tab=confirmed",
  );
  expect((await page.goto("/admin/orders/SL-KHONG-CO"))?.status()).toBe(404);
  await context.close();
});
