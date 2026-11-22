import { readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { ADMIN_TEST_PASSWORD, BASE_URL } from "../playwright.config";
import { expect, test } from "./fixtures";

// Phải trùng ORDERS_FILE trong playwright.config.ts
const ORDERS_FILE = path.join(tmpdir(), "shoplite-e2e-orders.json");

test("khách đặt hàng rồi tự hủy; trình duyệt khác không hủy được", async ({
  page,
  request,
  shop,
}) => {
  await shop.addToCart("cap-usb-c-ben-du-2m");
  await page.goto("/checkout");
  await shop.fillCheckout();
  const id = await shop.placeOrder();

  // Context khác (không cookie grant): PATCH trả 401 và đơn không đổi
  const denied = await request.patch(`/api/orders/${id}`, { data: { status: "cancelled" } });
  expect(denied.status()).toBe(401);
  await page.reload();
  await expect(page.getByText("Chờ xác nhận")).toBeVisible();

  await page.getByRole("button", { name: "Hủy đơn hàng" }).click();
  await page.getByRole("button", { name: "Xác nhận hủy" }).click();
  await expect(page.getByRole("heading", { level: 1 }).getByText("Đã hủy")).toBeVisible();
  await expect(page.getByRole("button", { name: "Hủy đơn hàng" })).toHaveCount(0);
  await expect(page.getByTestId("rejection-notice")).toHaveText("Bạn đã hủy đơn");
  await expect(page.getByTestId("rejection-notice")).toBeFocused();
  await expect(page.getByTestId("timeline-entry").first()).toContainText("Đã hủy");
});

test("nhân viên từ chối vì hết hàng: khách thấy lý do và link danh mục", async ({ browser }) => {
  const staff = await browser.newContext({ baseURL: BASE_URL });
  const customer = await browser.newContext({ baseURL: BASE_URL });
  await staff.request.post("/api/admin/login", { data: { password: ADMIN_TEST_PASSWORD } });
  const placed = await customer.request.post("/api/orders", {
    data: {
      customer: { fullName: "Khách Từ Chối", phone: "0912345678", address: "1 A, Quận 1, TP.HCM" },
      shippingMethod: "standard",
      paymentMethod: "cod",
      items: [{ productId: "p010", quantity: 1 }],
    },
  });
  const { id } = await placed.json();
  const rejected = await staff.request.patch(`/api/admin/orders/${id}`, {
    data: { from: "pending", to: "cancelled", reason: "out_of_stock" },
  });
  expect(rejected.status()).toBe(200);

  const page = await customer.newPage();
  await page.goto(`/orders/${id}`);
  const notice = page.getByTestId("rejection-notice");
  await expect(notice).toContainText("Shop đã từ chối đơn, lý do: Hết hàng");
  await expect(notice.getByRole("link", { name: "Xem sản phẩm cùng danh mục" })).toHaveAttribute(
    "href",
    "/products?category=phu-kien",
  );
  await expect(page.getByTestId("timeline-entry")).toHaveCount(2);

  const staffPage = await staff.newPage();
  await staffPage.goto(`/admin/orders/${id}`);
  await expect(staffPage.getByText(/Đặt lúc .* · Từ chối · Hết hàng/)).toBeVisible();
  await expect(staffPage.getByRole("heading", { name: "Lịch sử trạng thái" })).toBeVisible();
  await expect(staffPage.getByTestId("timeline-entry").first()).toContainText("Đã hủy");
  await staffPage.goto("/admin?tab=done");
  await expect(staffPage.getByTestId("admin-order-row").filter({ hasText: id })).toContainText(
    "Từ chối · Hết hàng",
  );
  await staff.close();
  await customer.close();
});

test("hủy đơn đã xác nhận trả 409 với message hiện có", async ({ page, shop }) => {
  await shop.addToCart("cap-usb-c-ben-du-2m");
  await page.goto("/checkout");
  await shop.fillCheckout();
  const id = await shop.placeOrder();

  const orders = JSON.parse(await readFile(ORDERS_FILE, "utf8")) as {
    id: string;
    status: string;
  }[];
  for (const order of orders) if (order.id === id) order.status = "confirmed";
  await writeFile(ORDERS_FILE, JSON.stringify(orders), "utf8");

  // File bị sửa từ ngoài (Story 3.2): server giữ snapshot cũ nên lần ghi đầu bị hủy (500, không ghi đè)
  // và nạp lại file; lần sau mới thấy đơn đã xác nhận.
  const stale = await page.request.patch(`/api/orders/${id}`, { data: { status: "cancelled" } });
  expect(stale.status()).toBe(500);

  const response = await page.request.patch(`/api/orders/${id}`, { data: { status: "cancelled" } });
  expect(response.status()).toBe(409);
  expect((await response.json()).error.code).toBe("INVALID_STATUS_TRANSITION");
});
