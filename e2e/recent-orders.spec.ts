import { BASE_URL } from "../playwright.config";
import { expect, test } from "./fixtures";

test("Đơn đã đặt trên máy này: thấy mã vừa đặt, bấm thì điền ô Mã đơn; trình duyệt mới không thấy", async ({
  page,
  browser,
  shop,
}) => {
  await shop.addToCart("cap-usb-c-ben-du-2m");
  await page.goto("/checkout");
  await shop.fillCheckout();
  const id = await shop.placeOrder();

  await page.goto("/orders");
  const recent = page.getByTestId("recent-order").first();
  await expect(recent).toHaveText(id);
  await recent.click();
  await expect(page.getByLabel("Mã đơn")).toHaveValue(id);
  await expect(page.getByLabel("4 số cuối số điện thoại")).toBeFocused();

  const fresh = await browser.newContext({ baseURL: BASE_URL });
  const other = await fresh.newPage();
  await other.goto("/orders");
  await expect(other.getByRole("heading", { name: "Tra cứu đơn hàng" })).toBeVisible();
  await expect(other.getByTestId("recent-order")).toHaveCount(0);
  await fresh.close();
});
