---
title: 'EXPERIENCE: ShopLite Ops'
status: final
created: 2026-11-20
updated: 2026-11-20
sources:
  - _bmad-output/planning-artifacts/prds/prd-shoplite-ops-2026-11-20/prd.md
companions:
  - DESIGN.md
  - mockups/admin-order-detail.html
---

# ShopLite Ops - Experience Spine

> Brownfield, delta trên sản phẩm đang chạy. Token tham chiếu `{path.to.token}` tới `DESIGN.md`. FR/UJ giữ mã nguyên văn PRD. Khi mockup mâu thuẫn với spine, **spine thắng**.

## Foundation

- **Nền tảng:** web responsive, Next.js App Router, Server Component mặc định; chỉ phần cần state (form đăng nhập, nhóm nút chuyển trạng thái) là Client Component.
- **Người dùng chính:** chị Hoa - một nhân viên, laptop ở kho, ~60 đơn/ngày; điện thoại 390px để xem nhanh. Khách hàng chỉ thấy thêm khối Tiến trình đơn.
- **Ngôn ngữ:** toàn bộ tiếng Việt; tiền qua `formatCurrency`, ngày giờ qua `formatDateTime` (`src/lib/format.ts`).
- **Nguyên tắc:** (1) chỉ cho bấm những gì hợp lệ; (2) mọi từ chối đều giải thích bằng câu người đọc hiểu; (3) không hành động không đảo ngược được mà không xác nhận lần hai.

## Information Architecture

```text
Cửa hàng (có sẵn)                      Trang vận hành (mới, không có link từ header cửa hàng)
/                                      /admin/login            đăng nhập bằng Mật khẩu cửa hàng
/products, /products/[slug]            /admin/orders           Hàng việc, ?status=<trạng thái> (mặc định pending)
/cart, /checkout, /wishlist            /admin/orders/[id]      chi tiết đơn + thao tác + lịch sử
/orders                                (đăng xuất: nút trong AdminHeader)
/orders/[id]   + khối Tiến trình đơn (FR-13)
```

- `/admin` (không có gì phía sau) chuyển tới `/admin/orders`.
- Header cửa hàng **không** thêm link tới Trang vận hành.

### Vòng đời trạng thái và nhãn nút

| Từ \ Sang       | Nút bước tiến (primary)       | Nút hủy (secondary → danger) |
| --------------- | ----------------------------- | ---------------------------- |
| Chờ xác nhận    | "Xác nhận đơn" → Đã xác nhận  | "Hủy đơn"                    |
| Đã xác nhận     | "Chuyển sang Đang giao"       | "Hủy đơn" (hoàn kho)         |
| Đang giao       | "Đánh dấu Đã giao"            | - (không hủy được)           |
| Đã giao, Đã hủy | - (trạng thái cuối, không nút) | -                            |

## Voice and Tone

Ngắn, nói đúng chuyện đã xảy ra và bước tiếp theo; không xin lỗi dài dòng, không hiện mã lỗi.

| Tình huống                                         | Câu hiển thị                                                                 |
| -------------------------------------------------- | ---------------------------------------------------------------------------- |
| Chuyển thành công                                  | "Đã chuyển đơn sang {nhãn trạng thái mới}."                                   |
| 409 `INVALID_STATUS_TRANSITION` (đơn đã đổi ở nơi khác) | "Đơn đã ở trạng thái {nhãn currentStatus}, không thể chuyển sang {nhãn đích}." |
| 409 `INSUFFICIENT_STOCK`                           | Dùng nguyên `message` của server: "Sản phẩm "{tên}" chỉ còn {N} sản phẩm" / "Sản phẩm "{tên}" đã hết hàng" |
| 400 `VALIDATION_ERROR` (ghi chú quá dài)           | "Ghi chú tối đa 200 ký tự."                                                  |
| 401 (phiên hết hạn)                                | "Phiên đăng nhập đã hết hạn, vui lòng đăng nhập lại." + chuyển `/admin/login` |
| Lỗi mạng / 500                                     | "Không thể cập nhật đơn hàng, vui lòng thử lại."                             |
| Sai mật khẩu                                       | "Mật khẩu không đúng."                                                       |
| Server chưa cấu hình mật khẩu                      | "Trang vận hành chưa được cấu hình. Liên hệ quản trị viên."                  |
| Hộp xác nhận hủy                                   | "Hủy đơn {mã đơn}? Thao tác này không hoàn tác được." · nút "Xác nhận hủy" / "Không" |

## Component Patterns

- **AdminStatusTabs** - điều hướng bằng URL (giống bộ lọc `/products`), là link thật, không phải state client.
- **AdminOrderRow** - cả dòng là một link; không đặt nút thao tác trên dòng (tránh bấm nhầm khi lướt). Thao tác chỉ ở trang chi tiết.
- **TransitionActions** - Client Component gọi `PATCH /api/admin/orders/:id` (xác thực bằng Phiên nhân viên), gửi `{ status, note }`. Thành công → `router.refresh()` + ActionMessage thành công + xóa ô ghi chú. Thất bại → ActionMessage lỗi theo bảng Voice and Tone, rồi `router.refresh()` để hiển thị trạng thái thật.
- **StatusTimeline** - Server Component nhận `statusHistory` và cờ `variant: "staff" | "customer"`; tạo ở Story 2.3 cho `/admin/orders/[id]` (có ghi chú, nhãn "Nhân viên"), dùng lại ở `/orders/[id]` trong Story 4.1 (không ghi chú, nhãn "Cửa hàng").
- **Hủy đơn** - dùng lại mẫu hai bước của `CancelOrderButton`: bấm "Hủy đơn" → hộp `rose-50` với câu hỏi và hai nút.

## State Patterns

| Màn hình / thành phần | Trạng thái              | Hiển thị                                                                                     |
| --------------------- | ----------------------- | -------------------------------------------------------------------------------------------- |
| Hàng việc             | Rỗng                    | `EmptyState` emoji 🎉 "Không có đơn nào {nhãn trạng thái}" (pending: "Đã xử lý hết đơn chờ") |
| Hàng việc             | Lỗi đọc dữ liệu         | Trang lỗi chung `src/app/error.tsx` (có sẵn)                                                 |
| Hàng việc             | Lọc `?status=` sai      | Coi như `pending`                                                                            |
| Chi tiết đơn          | Mã đơn không tồn tại    | `notFound()` → trang 404 có sẵn                                                              |
| Chi tiết đơn          | Trạng thái cuối         | Không có nhóm nút; dòng chữ "Đơn đã {nhãn}, không còn thao tác nào."                          |
| TransitionActions     | Đang gửi                | Mọi nút `disabled`, nút vừa bấm hiện "Đang cập nhật..."                                       |
| TransitionActions     | Lỗi                     | ActionMessage lỗi, nút bật lại, trang refresh trạng thái thật                                |
| Ô ghi chú             | > 200 ký tự             | Bộ đếm (tính sau khi bỏ khoảng trắng hai đầu) đổi `rose-600` "201/200", nút gửi `disabled`   |
| Đăng nhập             | Đang gửi / sai / chưa cấu hình | Nút "Đang đăng nhập..." / thông báo dưới ô mật khẩu / thông báo thay cho form          |
| Tiến trình đơn        | Đơn cũ                  | Một bước duy nhất (trạng thái hiện tại, người thực hiện "Hệ thống")                           |
| Tiến trình đơn        | Đơn đã hủy              | Bước cuối "Đã hủy" chấm slate; người thực hiện "Khách hàng" hoặc "Cửa hàng" (khách) / "Nhân viên" (trang vận hành) |

## Interaction Primitives

- Thao tác thay đổi dữ liệu luôn là **nút** (`<button>`), điều hướng luôn là **link** (`<a>`).
- Không có optimistic update: giao diện chỉ đổi trạng thái sau khi server trả 200.
- Bấm đúp bị chặn ở giao diện (nút `disabled` khi đang gửi) **và** ở server (FR-1: chuyển sang chính trạng thái hiện tại là không hợp lệ).
- Phiên hết hạn giữa chừng → mọi thao tác nhận 401 → chuyển về `/admin/login?next=<trang hiện tại>`.

## Accessibility Floor

- Ô mật khẩu và ô ghi chú có `<label>` hiển thị ("Mật khẩu cửa hàng", "Ghi chú (không bắt buộc)").
- Focus nhìn thấy được: dùng `focus-visible:outline-2` có sẵn trong `buttonStyles`; link dòng hàng việc có outline khi focus.
- Không phân biệt trạng thái **chỉ bằng màu**: badge có chữ, tuổi đơn chờ lâu có icon + chữ "chờ lâu", bước hiện tại có chữ "Hiện tại".
- ActionMessage lỗi `role="alert"`, thành công `role="status"`; hộp xác nhận hủy chuyển focus vào nút "Không".
- Tab lọc đang chọn có `aria-current="page"`; nhóm tab có `aria-label="Lọc theo trạng thái"`.
- Vùng chạm tối thiểu 40px (nút size `md`) trên mobile.

## Key Flows

### UJ-1. Chị Hoa dọn hàng việc buổi sáng (FR-7, FR-8, FR-9, FR-10)

1. Mở `/admin/orders` → chưa có phiên → `/admin/login?next=/admin/orders`.
2. Nhập mật khẩu → "Đăng nhập" → quay lại `/admin/orders` (tab "Chờ xác nhận · 12").
3. Bấm dòng đầu (đơn chờ lâu nhất, "chờ lâu 5 giờ") → `/admin/orders/SL-...`.
4. Bấm "Xác nhận đơn" → "Đã chuyển đơn sang Đã xác nhận." · badge đổi · lịch sử thêm dòng.
5. Quay lại hàng việc (link "← Hàng việc", giữ `?status=pending`) → đơn vừa xử lý đã rời tab.
- **Thiếu hàng:** bước 4 trả `INSUFFICIENT_STOCK` → ActionMessage lỗi nêu sản phẩm và số còn lại; chị nhập ghi chú, bấm "Hủy đơn" → hộp xác nhận → "Xác nhận hủy".
- Mockup tham chiếu: [mockups/admin-order-detail.html](mockups/admin-order-detail.html).

### UJ-2. Anh Minh xem tiến trình đơn (FR-13, FR-14)

1. `/orders` (không đổi) → bấm đơn → `/orders/[id]`.
2. Dưới header đơn, thẻ "Tiến trình đơn hàng" (`StatusTimeline`, không ghi chú): Chờ xác nhận → Đã xác nhận → Đang giao "Hiện tại".
3. Nút "Hủy đơn hàng" chỉ hiện khi đơn Chờ xác nhận (giữ nguyên hành vi).

### UJ-3. Thao tác cùng lúc (FR-1, FR-9)

1. Chị Hoa mở đơn ở tab A; khách hủy đơn trên web.
2. Chị bấm "Xác nhận đơn" ở tab A → 409, `details.currentStatus = cancelled` → "Đơn đã ở trạng thái Đã hủy, không thể chuyển sang Đã xác nhận." → trang refresh, không còn nút nào.

## Responsive & Platform

- ≥ 640px: dòng hàng việc một hàng (mã + badge | khách · số SP | tổng tiền | tuổi đơn); chi tiết đơn hai cột cho khối "Người nhận" và "Giao hàng & thanh toán" (như `/orders/[id]`).
- 390px: dòng hàng việc hai hàng; tab lọc cuộn ngang; nhóm nút chuyển trạng thái full-width xếp dọc, nút bước tiến ở trên.

## data-testid

Giữ nguyên mọi `data-testid` hiện có (`order-row`, `discount-amount`, `order-discount`...). Thêm:

| data-testid               | Gắn vào                                         |
| ------------------------- | ----------------------------------------------- |
| `admin-status-tab`        | mỗi tab lọc                                     |
| `admin-order-row`         | mỗi dòng hàng việc                              |
| `order-transition-button` | mỗi nút chuyển trạng thái (kèm `data-status`)   |
| `order-action-message`    | ActionMessage                                   |
| `order-timeline`          | khối StatusTimeline                             |
| `order-timeline-step`     | mỗi bước trong StatusTimeline                   |
