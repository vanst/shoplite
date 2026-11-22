import { randomInt } from "node:crypto";
import { expect, test, type Browser, type Page } from "@playwright/test";
import { ADMIN_TEST_PASSWORD, BASE_URL } from "../playwright.config";
import { LOGIN_LOCKED_MESSAGE } from "../src/features/admin/admin-messages";

/** Mỗi test một IP riêng (qua x-forwarded-for) để bộ đếm khóa đăng nhập không lan sang test khác. */
function randomIp(): string {
  return `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
}

async function newPageWithIp(browser: Browser, ip: string): Promise<Page> {
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  return context.newPage();
}

/** Gửi form đăng nhập và chờ phản hồi của API để không đọc nhầm banner của lần trước. */
async function submitPassword(page: Page, password: string) {
  await page.getByLabel("Mật khẩu").fill(password);
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/admin/login")),
    page.getByRole("button", { name: "Đăng nhập" }).click(),
  ]);
}

test("chưa đăng nhập thì /admin chuyển tới trang đăng nhập kèm next", async ({ browser }) => {
  const page = await newPageWithIp(browser, randomIp());
  await page.goto("/admin");

  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
  await expect(page.getByRole("heading", { name: "Đăng nhập quản trị" })).toBeVisible();
});

test("sai mật khẩu thì hiện banner lỗi và ở lại trang đăng nhập", async ({ browser }) => {
  const page = await newPageWithIp(browser, randomIp());
  await page.goto("/admin/login");

  await submitPassword(page, "mat-khau-sai");

  await expect(page.getByTestId("login-error")).toHaveText("Mật khẩu không đúng");
  await expect(page).toHaveURL(/\/admin\/login/);
});

test("đăng nhập đúng vào /admin, đăng xuất rồi phải đăng nhập lại", async ({ browser }) => {
  const page = await newPageWithIp(browser, randomIp());
  await page.goto("/admin");
  await submitPassword(page, ADMIN_TEST_PASSWORD);

  await expect(page).toHaveURL(/\/admin$/);
  await expect(page.getByTestId("admin-logout")).toHaveText("Đăng xuất");

  await page.getByTestId("admin-logout").click();
  await expect(page).toHaveURL(/\/admin\/login/);
  await expect(page.getByTestId("admin-logout")).toHaveCount(0);

  await page.goto("/admin");
  await expect(page).toHaveURL(/\/admin\/login\?next=%2Fadmin$/);
});

test("khóa đăng nhập sau 5 lần sai, vẫn từ chối mật khẩu đúng và không ảnh hưởng IP khác", async ({
  browser,
}) => {
  const page = await newPageWithIp(browser, randomIp());
  await page.goto("/admin/login");

  for (let i = 0; i < 5; i++) {
    await submitPassword(page, `mat-khau-sai-${i}`);
    await expect(page.getByTestId("login-error")).toHaveText("Mật khẩu không đúng");
  }

  await submitPassword(page, ADMIN_TEST_PASSWORD);
  await expect(page.getByTestId("login-error")).toHaveText(LOGIN_LOCKED_MESSAGE);
  await expect(page).toHaveURL(/\/admin\/login/);

  // IP khác không bị khóa
  const other = await newPageWithIp(browser, randomIp());
  await other.goto("/admin/login");
  await submitPassword(other, ADMIN_TEST_PASSWORD);
  await expect(other).toHaveURL(/\/admin$/);
  await expect(other.getByTestId("admin-logout")).toBeVisible();
});
