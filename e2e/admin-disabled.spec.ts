import { expect, test, type Page } from "@playwright/test";
import { DISABLED_BASE_URL } from "../playwright.config";

// Server thứ hai không đặt ADMIN_PASSWORD: khu vực quản trị phải biến mất hoàn toàn.
test.use({ baseURL: DISABLED_BASE_URL });

async function visibleText(page: Page, url: string) {
  const response = await page.goto(url);
  expect(response?.status()).toBe(404);
  return page.locator("body").innerText();
}

test("chưa cấu hình thì /admin và /admin/login giống hệt URL không tồn tại", async ({ page }) => {
  const missing = await visibleText(page, "/trang-khong-ton-tai-e2e");
  expect(missing).toContain("Không tìm thấy trang");
  // 404 phải có khung khách (Header + Footer), không phải trang trống
  await expect(page.getByRole("link", { name: "ShopLite - Trang chủ" })).toBeVisible();
  await expect(page.getByRole("contentinfo")).toBeVisible();

  for (const url of ["/admin", "/admin/login"]) {
    const text = await visibleText(page, url);
    expect(text).toContain("Không tìm thấy trang");
    expect(text).not.toContain("Quản trị");
    expect(text).toBe(missing);
  }
});

test("chưa cấu hình thì API đăng nhập trả 404 thân rỗng", async ({ request }) => {
  const response = await request.post("/api/admin/login", { data: { password: "bat-ky" } });

  expect(response.status()).toBe(404);
  expect(await response.text()).toBe("");
});
