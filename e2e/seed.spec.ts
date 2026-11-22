import { expect, test } from "./fixtures";

// Seed cho generator: fixture `shop` và `createPendingOrder` đã sẵn; giỏ bắt đầu trống.
test("seed: thêm sản phẩm vào giỏ bằng fixture shop", async ({ page, shop }) => {
  await shop.addToCart("cap-usb-c-ben-du-2m");
  await expect(page.getByTestId("cart-count")).toHaveText("1");
});
