import { randomInt } from "node:crypto";
import type { Browser, Page } from "@playwright/test";
import { BASE_URL } from "../playwright.config";
import {
  LOOKUP_LOCKED_MESSAGE,
  LOOKUP_NOT_FOUND_MESSAGE,
} from "../src/features/order-access/lookup-messages";
import { expect, test } from "./fixtures";

// SĐT trong fixtures là 0912345678
const RIGHT_DIGITS = "5678";

/** Mỗi test một IP riêng (x-forwarded-for) để bộ đếm khóa tra cứu không lan sang test khác. */
async function newPageWithIp(browser: Browser): Promise<Page> {
  const ip = `10.${randomInt(256)}.${randomInt(256)}.${randomInt(1, 255)}`;
  const context = await browser.newContext({
    baseURL: BASE_URL,
    extraHTTPHeaders: { "x-forwarded-for": ip },
  });
  return context.newPage();
}

async function submitLookup(page: Page, orderId: string, digits: string) {
  await page.getByLabel("Mã đơn").fill(orderId);
  await page.getByLabel("4 số cuối số điện thoại").fill(digits);
  await Promise.all([
    page.waitForResponse((response) => response.url().endsWith("/api/orders/lookup")),
    page.getByRole("button", { name: "Tra cứu" }).click(),
  ]);
}

test("menu có 'Tra cứu đơn' dẫn tới trang tra cứu, không có danh sách đơn", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("navigation").getByRole("link", { name: "Tra cứu đơn" }).click();
  await expect(page).toHaveURL(/\/orders$/);
  await expect(page.getByRole("heading", { name: "Tra cứu đơn hàng" })).toBeVisible();
  await expect(page.getByTestId("order-row")).toHaveCount(0);
});

test("sai mã đơn và sai 4 số cùng một câu thông báo", async ({ browser, createPendingOrder }) => {
  const id = await createPendingOrder();
  const page = await newPageWithIp(browser);
  await page.goto("/orders");

  await submitLookup(page, "SL-20200101-AAAAAA", RIGHT_DIGITS);
  await expect(page.getByTestId("lookup-error")).toHaveText(LOOKUP_NOT_FOUND_MESSAGE);

  await submitLookup(page, id, "0000");
  await expect(page.getByTestId("lookup-error")).toHaveText(LOOKUP_NOT_FOUND_MESSAGE);
});

test("tra cứu đúng thì thấy bản xem che của đơn, không có SĐT trên URL", async ({
  browser,
  createPendingOrder,
}) => {
  const id = await createPendingOrder();
  const page = await newPageWithIp(browser);
  await page.goto("/orders");
  await submitLookup(page, id.toLowerCase(), RIGHT_DIGITS);

  await expect(page).toHaveURL(`/orders/${id}`);
  await expect(page.getByRole("heading", { name: new RegExp(`Đơn hàng ${id}`) })).toBeVisible();
  expect(page.url()).not.toContain(RIGHT_DIGITS);
});

test("người dùng khác mở URL đơn chỉ thấy form điền sẵn mã đơn", async ({
  browser,
  createPendingOrder,
}) => {
  const id = await createPendingOrder();
  const page = await newPageWithIp(browser);
  const response = await page.goto(`/orders/${id}`);
  expect(response?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Tra cứu đơn hàng" })).toBeVisible();
  await expect(page.getByLabel("Mã đơn")).toHaveValue(id);
  await expect(page.getByText("Người nhận")).toHaveCount(0);
});

test("5 lần sai liên tiếp thì thấy câu khóa 429 dù lần sau nhập đúng", async ({
  browser,
  createPendingOrder,
}) => {
  const id = await createPendingOrder();
  const page = await newPageWithIp(browser);
  await page.goto("/orders");
  for (let i = 0; i < 5; i++) await submitLookup(page, id, "0000");
  await submitLookup(page, id, RIGHT_DIGITS);
  await expect(page.getByTestId("lookup-error")).toHaveText(LOOKUP_LOCKED_MESSAGE);
});
