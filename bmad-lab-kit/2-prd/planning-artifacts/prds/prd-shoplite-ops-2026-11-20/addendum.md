---
title: Addendum - ShopLite Ops
created: 2026-11-20
updated: 2026-11-20
companion_of: prd.md
audience: Architect (bmad-architecture), Dev
---

# Addendum: ShopLite Ops

Chi tiết kỹ thuật nghe được trong lúc làm PRD, không thuộc về "hệ thống phải làm gì" nên không nằm trong `prd.md`. Architect quyết định cuối cùng; các mục dưới đây là **đầu vào**, không phải quyết định kiến trúc.

## 1. Hiện trạng code liên quan (đã kiểm chứng)

| Hiện trạng                                                                                                                            | Vị trí                                                                     |
| ------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `ORDER_STATUSES` có 5 trạng thái, `ORDER_STATUS_LABELS` có nhãn tiếng Việt; `Order` chỉ có `createdAt`, `updatedAt`                     | `src/features/orders/types.ts`                                             |
| `cancelOrder(id)` tự gán `{ ...order, status: "cancelled" }`, ném `INVALID_STATUS_TRANSITION` khi `status !== "pending"`                 | `src/features/orders/order-service.ts`                                     |
| `placeOrder` so `quantity > product.stock` với `stock` tĩnh, không trừ kho; `findProduct` mặc định là `getProductById` (đồng bộ)        | `src/features/orders/order-service.ts`, `src/features/catalog/catalog-service.ts` |
| `OrderRepository` = `findAll` / `findById` / `save`; bản JSON đọc - sửa - ghi cả file, luôn ghi qua `${filePath}.tmp` rồi `rename`       | `src/features/orders/order-repository.ts`                                  |
| `orderService` singleton tạo một lần ở module scope, đọc `ORDERS_FILE`                                                                 | `src/features/orders/server.ts`                                            |
| `PATCH /api/orders/:id` chỉ nhận `{ "status": "cancelled" }`                                                                           | `src/app/api/orders/[id]/route.ts`                                         |
| `OrderErrorCode` chưa có mã cho lỗi xác thực                                                                                           | `src/features/orders/order-errors.ts`                                      |
| Giỏ hàng lưu snapshot `stock` lúc thêm vào giỏ; `getMaxQuantity(stock)` giới hạn số lượng                                               | `src/features/cart/types.ts`, `src/features/cart/cart-reducer.ts`          |
| `StockBadge` dùng `getStockStatus` và `LOW_STOCK_THRESHOLD = 5`                                                                         | `src/features/catalog/components/stock-badge.tsx`                          |
| Next.js 16 dùng `src/proxy.ts` (thay cho `middleware.ts`); tài liệu nằm trong `node_modules/next/dist/docs/`                            | -                                                                          |
| Zod hiện chỉ được phép trong `checkout-schema.ts` và `coupon-schema.ts` (quy ước trong `AGENTS.md`)                                     | `AGENTS.md`                                                                |

## 2. Lựa chọn kỹ thuật đã nghe được

- Máy trạng thái là **hàm thuần** (nhận đơn, trạng thái đích, người thực hiện, thời điểm; trả đơn mới hoặc ném `OrderError`) để test được toàn bộ ma trận mà không cần file.
- `cancelOrder` của khách phải dùng lại hàm đó (rủi ro R6 trong brainstorm).
- Lịch sử nằm **trong** bản ghi đơn (`statusHistory`), không tách file riêng.
- Tồn kho có repository riêng (`storage/inventory.json`) theo kiểu `OrderRepository`, có bản in-memory cho test.
- Chống ghi đồng thời bằng **hàng đợi tuần tự trong tiến trình** (promise chain), bọc trọn chu trình đọc - kiểm tra - ghi của cả đơn lẫn tồn kho.
- Xác thực API nhân viên bằng header `Authorization: Bearer`, so sánh `crypto.timingSafeEqual`.
- Phiên trang vận hành: cookie HttpOnly ký HMAC-SHA256, không lưu phiên phía server.
- Mã lỗi mới: `UNAUTHORIZED` (401). Dùng lại `INSUFFICIENT_STOCK` (409), `INVALID_STATUS_TRANSITION` (409), `ORDER_NOT_FOUND` (404), `VALIDATION_ERROR` (400).

## 3. Phương án đã bị loại

| Phương án                                                         | Lý do loại                                                                                      |
| ----------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| Giữ hàng ngay khi khách đặt (tính đơn `pending` vào "đã bán")      | Đơn ảo (COD, không đăng nhập) khóa hàng của khách thật; chủ sản phẩm chọn trừ khi xác nhận      |
| Tính tồn kho bằng cách cộng dồn từ `orders.json` mỗi lần đọc        | Mỗi trang sản phẩm phải đọc cả file đơn; khó giải thích khi nhập hàng                          |
| Sửa trực tiếp `stock` trong `src/data/products.ts` lúc chạy         | File mã nguồn không phải nơi lưu dữ liệu ghi được; mất khi deploy lại                          |
| Chỉ dựa vào `src/proxy.ts` để bảo vệ `/api/admin/*`                 | Proxy là lớp tiện lợi; route handler vẫn phải tự kiểm tra (phản biện của Amelia)                |
| Tài khoản riêng từng nhân viên (bảng user, hash mật khẩu)           | Ngoài MVP - chỉ có 1 nhân viên                                                                  |
| Lock file trên đĩa để chống ghi đồng thời giữa nhiều tiến trình    | Chỉ chạy 1 tiến trình; lock file thêm độ phức tạp và rủi ro kẹt khóa                           |

## 4. Gợi ý chia giai đoạn

1. Vòng đời đơn + lịch sử + API nhân viên (FR-1 → FR-6) - tự đứng được, test bằng `curl`.
2. Tồn kho thật (FR-10 → FR-12) - rủi ro dữ liệu cao nhất, nên làm sớm.
3. Trang vận hành (FR-7 → FR-9).
4. Timeline cho khách (FR-13, FR-14).
