---
title: 'DESIGN: ShopLite Ops'
status: final
created: 2026-11-20
updated: 2026-11-20
sources:
  - _bmad-output/planning-artifacts/prds/prd-shoplite-ops-2026-11-20/prd.md
name: ShopLite
description: >-
  Design system ngầm định của ShopLite (Tailwind CSS v4.3.3, không có lớp token ngữ nghĩa,
  globals.css chỉ khai báo --font-sans). File này ghi token HIỆN CÓ trích từ code + DELTA cho
  Trang vận hành và Tiến trình đơn. Không thiết kế lại phần đã có.
# Hex = chuyển đổi từ giá trị OKLCH của Tailwind v4 (node_modules/tailwindcss/theme.css),
# KHÔNG phải bảng hex của Tailwind v3. Khóa màu = tên class Tailwind. Sản phẩm chỉ có light mode.
colors:
  indigo-50: '#EEF2FF'    # hiện có: nền badge shipping, nav active
  indigo-200: '#C6D2FF'   # hiện có: ring badge shipping
  indigo-500: '#615FFF'   # hiện có: hover nút primary
  indigo-600: '#4F39F6'   # hiện có: nút primary, logo, link hover - oklch(51.1% 0.262 276.966)
  indigo-700: '#432DD7'   # hiện có: chữ badge shipping
  white: '#FFFFFF'        # hiện có: nền thẻ, header
  slate-50: '#F8FAFC'     # hiện có: nền trang (layout.tsx)
  slate-100: '#F1F5F9'    # hiện có: nền badge cancelled, hover ghost, divider trong thẻ
  slate-200: '#E2E8F0'    # hiện có: ring thẻ, border header
  slate-300: '#CAD5E2'    # hiện có: ring nút secondary, input
  slate-500: '#62748E'    # hiện có: chữ phụ, metadata, chữ badge cancelled
  slate-600: '#45556C'    # hiện có: chữ thân trong thẻ
  slate-700: '#314158'    # hiện có: label form, chữ nút ghost
  slate-900: '#0F172B'    # hiện có: chữ chính
  rose-50: '#FFF1F2'      # hiện có: nền hộp xác nhận hủy, banner lỗi
  rose-200: '#FFCCD3'     # DELTA: ring thông báo lỗi thao tác
  rose-600: '#EC003F'     # hiện có: nút danger, chữ lỗi field
  rose-700: '#C70036'     # hiện có: chữ banner lỗi
  emerald-50: '#ECFDF5'   # hiện có: nền banner thành công
  emerald-200: '#A4F4CF'  # hiện có: ring banner thành công
  emerald-600: '#009966'  # hiện có: icon CircleCheck
  emerald-700: '#007A55'  # hiện có: chữ badge delivered
  amber-50: '#FFFBEB'     # hiện có: nền badge pending
  amber-200: '#FEE685'    # hiện có: ring badge pending
  amber-700: '#BB4D00'    # hiện có: chữ badge pending, cảnh báo "Chỉ còn N"
  sky-50: '#F0F9FF'       # hiện có: nền badge confirmed
  sky-200: '#B8E6FE'      # hiện có: ring badge confirmed
  sky-700: '#0069A8'      # hiện có: chữ badge confirmed
typography:
  # Be Vietnam Pro qua next/font/google, subsets latin + vietnamese, weight 400/500/600/700 (layout.tsx)
  h1-page:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 24px          # text-2xl font-bold (orders/page.tsx)
    fontWeight: '700'
    lineHeight: '1.333'
  h2-card:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 18px          # text-lg font-semibold
    fontWeight: '600'
    lineHeight: '1.556'
  h2-card-sm:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 16px          # text-base font-semibold
    fontWeight: '600'
    lineHeight: '1.5'
  body-sm:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 14px          # text-sm - chữ mặc định trong thẻ
    fontWeight: '400'
    lineHeight: '1.429'
  label:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 14px          # text-sm font-medium
    fontWeight: '500'
    lineHeight: '1.429'
  caption:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 12px          # text-xs - metadata, tuổi đơn, thời điểm trong timeline
    fontWeight: '400'
    lineHeight: '1.333'
  badge:
    fontFamily: 'Be Vietnam Pro'
    fontSize: 12px          # text-xs font-semibold (order-status-badge.tsx)
    fontWeight: '600'
    lineHeight: '1.333'
rounded:
  lg: 8px                   # rounded-lg - logo, ô nhỏ
  xl: 12px                  # rounded-xl - nút, input, hộp xác nhận
  2xl: 16px                 # rounded-2xl - thẻ, dòng đơn hàng
  full: 9999px              # rounded-full - badge, chấm timeline
spacing:
  '1': 4px
  '2': 8px
  '3': 12px
  '4': 16px                 # px-4 - lề trang mobile
  '5': 20px                 # p-5 - padding thẻ
  '6': 24px                 # gap-6 - khoảng cách giữa các khối trang chi tiết
  '8': 32px                 # py-8 - lề trên/dưới trang
  page-max: 896px           # max-w-4xl - trang đơn hàng; Trang vận hành dùng max-w-5xl (1024px)
components:
  button-primary:
    backgroundColor: '{colors.indigo-600}'
    textColor: '{colors.white}'
    rounded: '{rounded.xl}'
    height: 40px            # size md (h-10); sm = 32px, lg = 48px
  button-secondary:
    backgroundColor: '{colors.white}'
    textColor: '{colors.slate-900}'
    borderColor: '{colors.slate-300}'
    rounded: '{rounded.xl}'
  button-danger:
    backgroundColor: '{colors.rose-600}'
    textColor: '{colors.white}'
    rounded: '{rounded.xl}'
  card:
    backgroundColor: '{colors.white}'
    borderColor: '{colors.slate-200}'
    rounded: '{rounded.2xl}'
    padding: '{spacing.5}'
  status-badge-pending:
    backgroundColor: '{colors.amber-50}'
    textColor: '{colors.amber-700}'
    borderColor: '{colors.amber-200}'
    rounded: '{rounded.full}'
  status-badge-confirmed:
    backgroundColor: '{colors.sky-50}'
    textColor: '{colors.sky-700}'
    borderColor: '{colors.sky-200}'
    rounded: '{rounded.full}'
  status-badge-shipping:
    backgroundColor: '{colors.indigo-50}'
    textColor: '{colors.indigo-700}'
    borderColor: '{colors.indigo-200}'
    rounded: '{rounded.full}'
  status-badge-delivered:
    backgroundColor: '{colors.emerald-50}'
    textColor: '{colors.emerald-700}'
    borderColor: '{colors.emerald-200}'
    rounded: '{rounded.full}'
  status-badge-cancelled:
    backgroundColor: '{colors.slate-100}'
    textColor: '{colors.slate-500}'
    borderColor: '{colors.slate-200}'
    rounded: '{rounded.full}'
  admin-status-tab:          # DELTA
    textColor: '{colors.slate-600}'
    activeBackgroundColor: '{colors.indigo-50}'
    activeTextColor: '{colors.indigo-700}'
    rounded: '{rounded.xl}'
    height: 36px
  admin-order-row:           # DELTA
    backgroundColor: '{colors.white}'
    borderColor: '{colors.slate-200}'
    rounded: '{rounded.2xl}'
    padding: '{spacing.4}'
  order-age:                 # DELTA
    typography: '{typography.caption}'
    textColor: '{colors.slate-500}'
    warningTextColor: '{colors.amber-700}'   # đơn pending chờ quá 4 giờ
  status-timeline-dot:       # DELTA
    size: 12px
    rounded: '{rounded.full}'
    doneColor: '{colors.indigo-600}'
    cancelledColor: '{colors.slate-500}'
    lineColor: '{colors.slate-200}'
  action-message-error:      # DELTA
    backgroundColor: '{colors.rose-50}'
    textColor: '{colors.rose-700}'
    borderColor: '{colors.rose-200}'
    rounded: '{rounded.xl}'
  action-message-success:    # DELTA
    backgroundColor: '{colors.emerald-50}'
    textColor: '{colors.emerald-700}'
    borderColor: '{colors.emerald-200}'
    rounded: '{rounded.xl}'
---

# ShopLite - Design Spine (token hiện có + delta cho ShopLite Ops)

## Brand & Style

ShopLite là cửa hàng đồ công nghệ nhỏ, giao diện sáng, gọn, nhiều khoảng trắng: nền `slate-50`, thẻ trắng bo `rounded-2xl` với `shadow-sm` và viền mảnh `ring-1 ring-slate-200`, điểm nhấn duy nhất là `indigo-600`. Ảnh sản phẩm là emoji trên nền gradient. Trang vận hành **không** có phong cách riêng: nó là ShopLite với mật độ thông tin cao hơn một chút, để nhân viên lướt nhanh. Không thêm màu thương hiệu mới.

## Colors

- **Indigo** (`{colors.indigo-600}`, oklch(51.1% 0.262 276.966), class `bg-indigo-600`) - hành động chính duy nhất trên mỗi màn hình (Xác nhận đơn, Chuyển sang Đang giao, Đăng nhập), tab lọc đang chọn, chấm timeline của bước đã qua.
- **Slate** - toàn bộ chữ và nền trung tính. `slate-900` chữ chính, `slate-500` metadata và tuổi đơn, `slate-200` viền thẻ và đường nối timeline.
- **Rose** - hủy đơn (nút `danger`, hộp xác nhận `rose-50`) và thông báo lỗi thao tác. Không dùng rose cho trạng thái Đã hủy (badge Đã hủy vẫn là slate như hiện nay).
- **Amber / Sky / Indigo / Emerald / Slate cho 5 trạng thái** - giữ nguyên `OrderStatusBadge` (`src/features/orders/components/order-status-badge.tsx`). Amber còn dùng cho tuổi đơn quá 4 giờ.
- **Emerald** - thông báo thao tác thành công ("Đã chuyển đơn sang Đã xác nhận").

## Typography

Một font duy nhất Be Vietnam Pro. Tiêu đề trang `{typography.h1-page}`; tiêu đề thẻ `{typography.h2-card}` hoặc `{typography.h2-card-sm}`; chữ trong thẻ `{typography.body-sm}`. Tuổi đơn và thời điểm trong timeline dùng `{typography.caption}` với `tabular-nums` để các cột số thẳng hàng.

## Layout & Spacing

Lưới 4px của Tailwind. Trang đơn hàng của khách giữ `max-w-4xl`; Trang vận hành dùng `max-w-5xl`, lề `px-4 py-8`. Dòng hàng việc là thẻ ngang (không dùng `<table>`) để xuống dòng tự nhiên ở 390px: trên mobile, tổng tiền và tuổi đơn xuống hàng dưới tên khách. Khoảng cách giữa các khối trang chi tiết `gap-6`.

## Elevation & Depth

Chỉ một mức: `shadow-sm` + `ring-1 ring-slate-200` cho mọi thẻ. Hover dòng hàng việc nâng lên `shadow-md` (như dòng đơn ở `/orders`). Header Trang vận hành dính trên cùng như header cửa hàng (`sticky top-0`, `bg-white/90 backdrop-blur`).

## Shapes

Nút và input `{rounded.xl}`; thẻ, dòng đơn `{rounded.2xl}`; badge và chấm timeline `{rounded.full}`. Không dùng góc vuông.

## Components

### Hiện có, dùng lại nguyên trạng

- `Button` / `buttonStyles` (`src/components/ui/button.tsx`): `primary`, `secondary`, `ghost`, `danger`; size `sm` h-8, `md` h-10, `lg` h-12.
- `OrderStatusBadge` - badge 5 trạng thái, luôn có chữ.
- `EmptyState` (`src/components/ui/empty-state.tsx`) - trạng thái rỗng của hàng việc.
- Hộp xác nhận hủy của `CancelOrderButton` (nền `rose-50`, hai nút) - mẫu cho hủy đơn phía nhân viên.
- `OrderTotals`, khối "Người nhận", khối "Giao hàng & thanh toán" của `/orders/[id]` - dùng lại ở chi tiết đơn phía nhân viên.

### Delta - Trang vận hành

- **AdminHeader [Δ]** - thanh trên cùng: logo ShopLite + chữ "Vận hành", bên phải nút `ghost` "Đăng xuất". Không có giỏ hàng/yêu thích.
- **AdminStatusTabs [Δ]** - 5 tab theo trạng thái (`{components.admin-status-tab}`), mỗi tab "Nhãn · số đơn"; là `<a>` đổi `?status=`, tab đang chọn có `aria-current="page"`. Mobile: cuộn ngang, không xuống dòng.
- **AdminOrderRow [Δ]** - thẻ `{components.admin-order-row}`: mã đơn (đậm) + badge trạng thái; tên khách · số sản phẩm; tổng tiền; tuổi đơn (`{components.order-age}`). Cả dòng là link tới chi tiết.
- **OrderAge [Δ]** - "12 phút", "3 giờ", "2 ngày"; đơn `pending` quá 4 giờ đổi sang `amber-700` **kèm** icon `Clock` và chữ "chờ lâu".
- **TransitionActions [Δ]** - nhóm nút ở đầu trang chi tiết: bước tiến (`primary`, ví dụ "Xác nhận đơn", "Chuyển sang Đang giao", "Đánh dấu Đã giao") đứng trước, "Hủy đơn" (`secondary`, mở hộp xác nhận `danger`) đứng sau. Có ô Ghi chú (textarea 3 dòng, bộ đếm "0/200").
- **ActionMessage [Δ]** - hộp thông báo dưới nhóm nút: lỗi `{components.action-message-error}`, thành công `{components.action-message-success}`; `role="alert"` cho lỗi, `role="status"` cho thành công.
- **StaffLoginForm [Δ]** - thẻ giữa màn hình rộng tối đa 384px: tiêu đề "Đăng nhập vận hành", ô "Mật khẩu cửa hàng", nút `primary` full-width "Đăng nhập".

### Delta - Tiến trình đơn (dùng chung khách và nhân viên)

- **StatusTimeline [Δ]** - danh sách dọc: chấm `{components.status-timeline-dot}` nối bằng đường `slate-200`; mỗi bước: nhãn trạng thái (`label`), thời điểm (`caption`), người thực hiện ("Khách hàng" / "Nhân viên" ở biến thể nhân viên, "Cửa hàng" ở biến thể khách / "Hệ thống"). Bước cuối có chữ "Hiện tại" (badge nhỏ) - không chỉ đổi màu. Biến thể nhân viên hiện thêm ghi chú (chữ nghiêng `slate-600`); biến thể khách **không** hiện ghi chú. Bước Đã hủy dùng chấm `slate-500`.

## Do's and Don'ts

- **Do** dùng lại `OrderStatusBadge`, `Button`, `EmptyState`; ghép class bằng `cn`.
- **Do** để mỗi màn hình chỉ có **một** nút `primary`.
- **Do** luôn kèm chữ cho mọi trạng thái (badge, tuổi đơn chờ lâu, bước hiện tại).
- **Don't** thêm màu mới hay dùng hex Tailwind v3 (`#4F46E5` là sai với v4).
- **Don't** dùng `<table>` cho hàng việc (vỡ ở 390px).
- **Don't** hiển thị ghi chú nội bộ của nhân viên ở trang của khách.
