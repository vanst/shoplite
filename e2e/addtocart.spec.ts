import { test } from "@playwright/test";

test("test", async ({ page }) => {
  await page.goto("http://localhost:3000/");
  await page.getByRole("link", { name: "Sản phẩm" }).click();
  await page.getByRole("link", { name: "Bàn phím cơ KeyPro 75%" }).click();
  await page.getByTestId("purchase-panel").getByRole("button", { name: "Thêm vào giỏ" }).click();
  await page
    .getByTestId("purchase-panel")
    .getByRole("button", { name: "Thêm vào giỏ" })
    .press("ControlOrMeta+-");
  await page
    .getByTestId("purchase-panel")
    .getByRole("button", { name: "Thêm vào giỏ" })
    .press("ControlOrMeta+-");
  await page.getByRole("link", { name: "Giỏ hàng (1 sản phẩm)" }).click();
  await page.getByRole("link", { name: "Tiến hành thanh toán" }).click();
  await page.getByRole("textbox", { name: "Họ và tên *" }).click();
  await page.getByRole("textbox", { name: "Họ và tên *" }).fill("Abc");
  await page.getByRole("textbox", { name: "Số điện thoại *" }).click();
  await page.getByRole("textbox", { name: "Số điện thoại *" }).fill("0914444444");
  await page.getByRole("textbox", { name: "Địa chỉ giao hàng *" }).click();
  await page.getByRole("textbox", { name: "Địa chỉ giao hàng *" }).fill("37 Huynh tat phat");
  await page.getByRole("button", { name: "Đặt hàng" }).click();
});
