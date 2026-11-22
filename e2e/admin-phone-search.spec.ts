import { randomInt } from "node:crypto";
import { expect, test } from "@playwright/test";
import { ADMIN_TEST_PASSWORD, BASE_URL } from "../playwright.config";

test("hotline: tìm theo SĐT thấy cả đơn lưu 0… và +84…, SĐT không lên URL hay title", async ({
  browser,
}) => {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: {
      "x-forwarded-for": `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`,
    },
  });
  const tail = String(randomInt(10_000_000, 99_999_999));
  const place = async (phone: string) => {
    const response = await context.request.post("/api/orders", {
      data: {
        customer: { fullName: "Lê Hotline", phone, address: "9 Lê Lợi Quận 1" },
        shippingMethod: "standard",
        paymentMethod: "cod",
        items: [{ productId: "p010", quantity: 1 }],
      },
    });
    return (await response.json()).id as string;
  };
  const first = await place(`09${tail}`);
  const second = await place(`+849${tail}`);
  await context.request.post("/api/admin/login", { data: { password: ADMIN_TEST_PASSWORD } });

  const page = await context.newPage();
  await page.goto("/admin");
  const search = page.getByTestId("admin-phone-search");
  await search.fill(`09${tail}`);
  await search.press("Enter");

  await expect(page.getByRole("heading", { name: `Kết quả cho 09${tail}` })).toBeFocused();
  await expect(page.getByTestId("admin-order-row").filter({ hasText: first })).toBeVisible();
  await expect(page.getByTestId("admin-order-row").filter({ hasText: second })).toBeVisible();
  expect(new URL(page.url()).pathname + new URL(page.url()).search).toBe("/admin");
  expect(await page.title()).toBe("Tìm theo SĐT · Quản trị");
  expect(await page.title()).not.toContain(tail);

  await page.getByRole("button", { name: "Xóa tìm kiếm" }).click();
  await expect(page.getByTestId("admin-tab-pending")).toBeVisible();
  await expect(search).toBeFocused();
  await context.close();
});
