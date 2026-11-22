import { expect, test as base, type APIRequestContext, type Page } from "@playwright/test";

export { expect };

type Customer = { fullName: string; phone: string; address: string };

const VALID_CUSTOMER: Customer = {
  fullName: "Nguyễn Văn Test",
  phone: "0912345678",
  address: "12 Nguyễn Huệ, Quận 1, TP.HCM",
};

/** Thao tác khách hay lặp lại; giỏ lưu ở localStorage nên mỗi test (context mới) bắt đầu với giỏ trống. */
function createShop(page: Page) {
  return {
    /** Mở trang sản phẩm theo slug, chọn số lượng rồi bấm "Thêm vào giỏ". */
    async addToCart(slug: string, quantity = 1) {
      await page.goto(`/products/${slug}`);
      const panel = page.getByTestId("purchase-panel");
      for (let i = 1; i < quantity; i++) {
        await panel.getByRole("button", { name: "Tăng số lượng" }).click();
      }
      await panel.getByRole("button", { name: "Thêm vào giỏ" }).click();
    },
    async fillCheckout(customer: Partial<Customer> = {}) {
      const { fullName, phone, address } = { ...VALID_CUSTOMER, ...customer };
      await page.getByLabel(/Họ và tên/).fill(fullName);
      await page.getByLabel(/Số điện thoại/).fill(phone);
      await page.getByLabel(/Địa chỉ giao hàng/).fill(address);
    },
    /** Bấm "Đặt hàng", chờ sang trang đơn và trả về mã đơn. */
    async placeOrder() {
      await page.getByRole("button", { name: "Đặt hàng" }).click();
      await expect(page).toHaveURL(/\/orders\/SL-\d{8}-[0-9A-F]{6}/);
      return page.url().match(/SL-\d{8}-[0-9A-F]{6}/)![0];
    },
  };
}

/** Tạo đơn "Chờ xác nhận" qua API (1 Cáp USB-C bện dù 2m, giao tiêu chuẩn) và trả về mã đơn. */
async function createPendingOrder(request: APIRequestContext) {
  const response = await request.post("/api/orders", {
    data: {
      customer: VALID_CUSTOMER,
      shippingMethod: "standard",
      paymentMethod: "cod",
      items: [{ productId: "p010", quantity: 1 }],
    },
  });
  expect(response.status()).toBe(201);
  return (await response.json()).id as string;
}

export const test = base.extend<{
  shop: ReturnType<typeof createShop>;
  createPendingOrder: () => Promise<string>;
}>({
  shop: async ({ page }, provide) => {
    await provide(createShop(page));
  },
  createPendingOrder: async ({ request }, provide) => {
    await provide(() => createPendingOrder(request));
  },
});
