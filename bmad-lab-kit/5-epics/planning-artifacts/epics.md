---
status: final
stepsCompleted: [1, 2, 3, 4]
inputDocuments:
  - _bmad-output/planning-artifacts/prds/prd-shoplite-ops-2026-11-20/prd.md
  - _bmad-output/planning-artifacts/prds/prd-shoplite-ops-2026-11-20/addendum.md
  - _bmad-output/planning-artifacts/architecture/architecture-shoplite-ops-2026-11-20/ARCHITECTURE-SPINE.md
  - _bmad-output/planning-artifacts/ux-designs/ux-shoplite-ops-2026-11-20/DESIGN.md
  - _bmad-output/planning-artifacts/ux-designs/ux-shoplite-ops-2026-11-20/EXPERIENCE.md
---

# ShopLite Ops - Epic Breakdown

## Overview

Tài liệu chia yêu cầu của PRD, UX và architecture spine của ShopLite Ops thành epic và story có thể implement. Nhân viên vận hành đơn hàng (xác nhận, giao, hủy) qua API và trang vận hành, tồn kho phản ánh hàng thật, khách thấy đơn của mình đang ở bước nào. Không thêm database hay dịch vụ ngoài; dữ liệu vẫn nằm trong `storage/`.

## Requirements Inventory

### Functional Requirements

- FR-1: Hệ thống chỉ cho phép 5 bước chuyển hợp lệ (`pending → confirmed | cancelled`, `confirmed → shipping | cancelled`, `shipping → delivered`); mọi cặp khác, kể cả chuyển sang chính trạng thái hiện tại, bị từ chối với `INVALID_STATUS_TRANSITION` kèm `details.currentStatus`.
- FR-2: Khách chỉ hủy được đơn `pending`, giữ nguyên thông báo và API hiện có.
- FR-3: Mỗi lần đổi trạng thái ghi đúng một mục lịch sử `{ status, at, actor, note? }`; ghi chú tối đa 200 ký tự.
- FR-4: Đơn cũ chưa có lịch sử vẫn đọc, liệt kê, chuyển trạng thái được; đọc không ghi lại file.
- FR-5: Nhân viên đổi trạng thái qua `PATCH /api/admin/orders/:id` với `{ status, note? }`.
- FR-6: API nhân viên fail-closed: thiếu/sai khóa hoặc server chưa cấu hình → 401 `UNAUTHORIZED`.
- FR-7: Nhân viên đăng nhập trang vận hành bằng mật khẩu cửa hàng (phiên 8 giờ) và đăng xuất.
- FR-8: Hàng việc lọc theo trạng thái trên URL, đơn chờ lâu nhất trước, có tuổi đơn và số đơn mỗi tab.
- FR-9: Chi tiết đơn chỉ hiện nút cho bước hợp lệ, hủy cần xác nhận, có ghi chú, thông báo lỗi tiếng Việt theo `currentStatus`.
- FR-10: Xác nhận đơn trừ kho; thiếu hàng → từ chối cả đơn; xác nhận đồng thời không bán vượt.
- FR-11: Hủy đơn `confirmed` hoàn kho; hủy đơn `pending` không đổi kho.
- FR-12: Đặt hàng và catalog dùng tồn kho thật trong `storage/inventory.json`.
- FR-13: Khách xem timeline trạng thái ở `/orders/[id]` (không hiện ghi chú nội bộ).
- FR-14: Luồng mua hàng và E2E hiện có không bị phá.

### NonFunctional Requirements

- NFR-1: Hai thao tác ghi đồng thời (đặt đơn, đổi trạng thái, trừ/hoàn kho) không làm mất dữ liệu hay làm tồn kho âm, trong phạm vi một tiến trình.
- NFR-2: Thiếu cấu hình bí mật (biến môi trường) thì API và trang vận hành **từ chối** truy cập (fail-closed); so sánh bí mật timing-safe.
- NFR-3: Đơn cũ trong `storage/orders.json` vẫn hoạt động mà không cần migrate.
- NFR-4: Toàn bộ text tiếng Việt; trạng thái không phân biệt chỉ bằng màu; form có label; focus nhìn thấy được.
- NFR-5: `npm run check` và `npm run test:e2e` pass sau mỗi story.

### Additional Requirements

- Từ spine: AD-1 (feature-based, route mỏng), AD-2 (server là nguồn sự thật), AD-3 (`OrderError` + `handleRouteError`, mã mới `UNAUTHORIZED` 401), AD-4 (`transitionOrder` thuần là chỗ duy nhất đổi trạng thái), AD-5 (`statusHistory` trong đơn, `withStatusHistory` ở mọi đường đọc), AD-6 (`InventoryRepository`, `storage/inventory.json`), AD-7 (một `writeQueue` chung bọc mọi chu trình đọc - sửa - ghi), AD-8 (`requireStaff` fail-closed), AD-9 (cookie phiên ký HMAC, `SameSite=Strict`, kiểm tra `Origin`), AD-10 (hợp đồng API nhân viên, Zod trong `order-schema.ts`).
- Cập nhật `AGENTS.md` khi thêm file Zod thứ ba và quy tắc nghiệp vụ mới (máy trạng thái, tồn kho).

### UX Design Requirements

- UX-DR1: Dùng lại `OrderStatusBadge`, `Button`, `EmptyState`; không thêm màu mới; hex token theo Tailwind v4.
- UX-DR2: Chỉ hiện nút cho bước hợp lệ kế tiếp; hủy đơn xác nhận hai bước theo mẫu `CancelOrderButton`.
- UX-DR3: Thông báo thao tác theo bảng Voice and Tone; lỗi `role="alert"`, thành công `role="status"`; không hiện mã lỗi thô.
- UX-DR4: `StatusTimeline` dùng chung khách/nhân viên; bước hiện tại có chữ "Hiện tại"; khách không thấy ghi chú.
- UX-DR5: Hàng việc là thẻ (không `<table>`), tab lọc là link `?status=`, chạy tốt ở 390px; thêm các `data-testid` trong EXPERIENCE.md.

### FR Coverage Map

- FR-1: Epic 1 - Story 1.1
- FR-2: Epic 1 - Story 1.1
- FR-3: Epic 1 - Story 1.2
- FR-4: Epic 1 - Story 1.2
- FR-5: Epic 1 - Story 1.3
- FR-6: Epic 1 - Story 1.3
- FR-7: Epic 2 - Story 2.1
- FR-8: Epic 2 - Story 2.2
- FR-9: Epic 2 - Story 2.3
- FR-10: Epic 3 - Story 3.1
- FR-11: Epic 3 - Story 3.1
- FR-12: Epic 3 - Story 3.2
- FR-13: Epic 4 - Story 4.1
- FR-14: Epic 4 - Story 4.1 (và mọi story qua NFR-5)

## Epic List

1. **Epic 1 - Vòng đời đơn hàng có kiểm soát** (FR-1 → FR-6): đơn đi qua các trạng thái hợp lệ, có lịch sử, nhân viên đổi được trạng thái qua API an toàn. Tự đứng được, kiểm bằng `curl`.
2. **Epic 2 - Trang vận hành cho nhân viên** (FR-7 → FR-9): nhân viên làm việc trên giao diện thay vì gọi API bằng tay. Dùng API của Epic 1.
3. **Epic 3 - Tồn kho thật** (FR-10 → FR-12): số tồn kho trên web khớp hàng thật. Dùng `changeStatusByStaff` và hàng đợi ghi của Epic 1.
4. **Epic 4 - Khách theo dõi tiến trình đơn** (FR-13, FR-14): khách thấy đơn đang ở bước nào. Dùng lịch sử của Epic 1.

---

## Epic 1: Vòng đời đơn hàng có kiểm soát

Mục tiêu: mọi thay đổi trạng thái đơn - của khách hay nhân viên - đi qua một quy tắc chung, được ghi lịch sử, và nhân viên đổi được trạng thái qua một API an toàn.

**FRs covered:** FR-1, FR-2, FR-3, FR-4, FR-5, FR-6

### Story 1.1: Máy trạng thái đơn hàng

As a nhân viên cửa hàng,
I want hệ thống chỉ cho phép các bước chuyển trạng thái hợp lệ,
So that đơn không bị nhảy cóc, quay ngược hay "sống lại" sau khi hủy.

Ràng buộc: AD-3, AD-4. Hàm thuần `transitionOrder(order, to, { actor, at })` và bảng `ALLOWED_TRANSITIONS` trong `src/features/orders/order-state-machine.ts`; `cancelOrder` hiện có phải dùng lại hàm này.

**Acceptance Criteria:**

**Given** đơn `pending`
**When** nhân viên chuyển sang `confirmed`
**Then** trả về đơn mới có `status: "confirmed"` và `updatedAt` = `at`
**And** đơn đầu vào không bị thay đổi

**Given** đơn `pending`
**When** nhân viên chuyển sang `shipping` hoặc `delivered`
**Then** bị từ chối với `OrderError("INVALID_STATUS_TRANSITION")` có `details.currentStatus = "pending"`

**Given** đơn `delivered` hoặc `cancelled`
**When** chuyển sang bất kỳ trạng thái nào
**Then** bị từ chối với `INVALID_STATUS_TRANSITION`

**Given** đơn `confirmed`
**When** chuyển sang chính `confirmed`
**Then** bị từ chối với `INVALID_STATUS_TRANSITION` (chặn bấm đúp)

**Given** đơn `confirmed`
**When** **khách hàng** hủy đơn qua `cancelOrder` / `PATCH /api/orders/:id`
**Then** bị từ chối với `INVALID_STATUS_TRANSITION` (409) và thông báo hiện có "Chỉ có thể hủy đơn hàng đang ở trạng thái Chờ xác nhận"

**Given** toàn bộ ma trận 5 × 5 trạng thái × 2 người thực hiện (`staff`, `customer`)
**Then** có unit test cho từng cặp với kết quả kỳ vọng viết tay (không suy ra từ `ALLOWED_TRANSITIONS`)

### Story 1.2: Lịch sử trạng thái đơn

As a nhân viên cửa hàng,
I want thấy ai đã đổi trạng thái đơn, lúc nào, kèm ghi chú,
So that tôi giải thích được với khách khi có khiếu nại.

Ràng buộc: AD-4, AD-5, NFR-3.

**Acceptance Criteria:**

**Given** khách vừa đặt đơn
**Then** `statusHistory` có đúng 1 mục `{ status: "pending", at: createdAt, actor: "customer" }`

**Given** một bước chuyển hợp lệ có ghi chú "Đã kiểm hàng"
**Then** `statusHistory` có thêm đúng 1 mục `{ status, at: updatedAt, actor, note: "Đã kiểm hàng" }`
**And** các mục cũ giữ nguyên, mục cuối trùng trạng thái hiện tại
**And** mảng `statusHistory` của đơn đầu vào không bị thay đổi

**Given** ghi chú có đúng 200 ký tự sau khi bỏ khoảng trắng hai đầu (kể cả khi có thêm khoảng trắng ở hai đầu)
**Then** được chấp nhận
**Given** ghi chú 201 ký tự sau khi bỏ khoảng trắng hai đầu
**Then** `transitionOrder` ném `OrderError("VALIDATION_ERROR")` có `details.note` (qua API sẽ thành 400)
**Given** ghi chú chỉ gồm khoảng trắng
**Then** mục lịch sử không có trường `note`

**Given** khách tự hủy đơn `pending`
**Then** mục cuối là `{ status: "cancelled", actor: "customer" }`

**Given** đơn cũ trong repository không có `statusHistory`
**When** đọc qua `getOrder` **hoặc** `listOrders`
**Then** đơn trả về có `statusHistory = [{ status: <hiện tại>, at: updatedAt, actor: "system" }]`
**And** repository không bị ghi lại

**Given** đơn cũ `pending`
**When** khách hủy đơn
**Then** lịch sử lưu gồm mục suy ra + mục `cancelled`

### Story 1.3: API chuyển trạng thái cho nhân viên

As a nhân viên cửa hàng,
I want gọi API để đổi trạng thái đơn,
So that trang vận hành (Epic 2) và công cụ khác dùng chung một quy tắc.

Ràng buộc: AD-3, AD-7, AD-8, AD-10, NFR-1, NFR-2. `PATCH /api/admin/orders/:id`, body validate bằng `staffStatusChangeSchema` (`src/features/orders/order-schema.ts`), xác thực bằng `requireStaff` (ở story này chỉ cần `Authorization: Bearer <STAFF_API_KEY>`; cookie phiên thêm ở Story 2.1). `note` validate bằng `z.string().trim().max(200).optional()`. Service mới `changeStatusByStaff(id, status, note)`; `createWriteQueue` bọc `placeOrder`, `cancelOrder`, `changeStatusByStaff`.

**Acceptance Criteria:**

**Given** header đúng khóa và bước chuyển hợp lệ
**When** gọi `PATCH /api/admin/orders/:id` với `{ "status": "confirmed", "note": "Đã kiểm hàng" }`
**Then** trả 200 với đơn đã cập nhật, mục lịch sử cuối có `actor: "staff"` và `note`

**Given** thiếu header, sai khóa, khóa sai cùng độ dài, hoặc **biến môi trường `STAFF_API_KEY` rỗng/chưa đặt** (kể cả client gửi `Bearer undefined`)
**Then** trả 401 `{ error: { code: "UNAUTHORIZED", ... } }` và không đọc/ghi đơn nào

**Given** bước chuyển không hợp lệ
**Then** trả 409 `INVALID_STATUS_TRANSITION` kèm `details.currentStatus`

**Given** mã đơn không tồn tại
**Then** trả 404 `ORDER_NOT_FOUND`

**Given** body không phải JSON, `status` không thuộc `ORDER_STATUSES`, hoặc `note` không phải chuỗi / dài hơn 200 ký tự
**Then** trả 400 `VALIDATION_ERROR`

**Given** hai yêu cầu `confirmed` cho cùng một đơn `pending` gửi đồng thời
**Then** đúng một yêu cầu thành công, yêu cầu kia nhận 409; lịch sử có đúng một mục `confirmed`

**Given** `PATCH /api/orders/:id` hiện có của khách
**Then** hành vi giữ nguyên (chỉ `{ "status": "cancelled" }`, chỉ khi `pending`)

**And** `UNAUTHORIZED` có trong `OrderErrorCode` + `HTTP_STATUS_BY_CODE`; `AGENTS.md` ghi nhận `order-schema.ts` là file Zod được phép và quy tắc máy trạng thái.

---

## Epic 2: Trang vận hành cho nhân viên

Mục tiêu: nhân viên đăng nhập, thấy hàng việc và xử lý đơn hằng ngày trên giao diện, không cần gọi API bằng tay.

**FRs covered:** FR-7, FR-8, FR-9

### Story 2.1: Đăng nhập nhân viên

As a nhân viên cửa hàng,
I want đăng nhập trang vận hành bằng mật khẩu cửa hàng,
So that chỉ người của cửa hàng mới thao tác được với đơn.

Ràng buộc: AD-8, AD-9, NFR-2. `POST /api/admin/session` (đăng nhập), `DELETE /api/admin/session` (đăng xuất) - route duy nhất dưới `/api/admin/` không gọi `requireStaff`; `src/proxy.ts` chuyển hướng `/admin/*`; `requireStaff` chấp nhận thêm cookie phiên.

**Acceptance Criteria:**

**Given** chưa có phiên
**When** mở `/admin/orders`
**Then** được chuyển tới `/admin/login?next=/admin/orders`

**Given** đúng mật khẩu `STAFF_PASSWORD`
**When** đăng nhập
**Then** nhận cookie `shoplite_staff` (`HttpOnly`, `SameSite=Strict`, hết hạn 8 giờ) và được chuyển tới `next` (mặc định `/admin/orders`; `next` không bắt đầu bằng `/admin` thì bỏ qua)

**Given** sai mật khẩu
**Then** thông báo "Mật khẩu không đúng.", không có cookie

**Given** server chưa đặt `STAFF_PASSWORD`
**Then** không ai đăng nhập được; trang hiện "Trang vận hành chưa được cấu hình. Liên hệ quản trị viên."

**Given** cookie hết hạn hoặc chữ ký sai (sửa một ký tự)
**Then** bị coi như chưa đăng nhập ở cả page và API

**Given** request thay đổi dữ liệu xác thực bằng cookie mà thiếu `Origin` hoặc `Origin` khác host
**Then** trả 401 `UNAUTHORIZED`

**Given** bấm "Đăng xuất"
**Then** cookie bị xóa và quay về `/admin/login`

### Story 2.2: Hàng việc theo trạng thái

As a nhân viên cửa hàng,
I want xem danh sách đơn lọc theo trạng thái, đơn chờ lâu nhất lên đầu,
So that tôi biết việc nào cần làm trước.

Ràng buộc: AD-5, AD-10, UX-DR1, UX-DR5. Trang `/admin/orders`, API `GET /api/admin/orders?status=`.

**Acceptance Criteria:**

**Given** đã đăng nhập
**When** mở `/admin/orders`
**Then** thấy tab "Chờ xác nhận" được chọn (`aria-current="page"`) và các đơn `pending` xếp theo `createdAt` cũ nhất trước

**Given** `?status=confirmed`
**Then** chỉ thấy đơn `confirmed`, `createdAt` cũ nhất trước; `?status=delivered` / `cancelled` / `shipping` thì `createdAt` mới nhất trước
**Given** `?status=abc`
**Then** coi như `pending`

**Given** một đơn đặt cách đây 5 giờ đang `pending`
**Then** dòng đơn hiện "5 giờ" kèm icon và chữ "chờ lâu" màu amber (quá 4 giờ)

**Given** không có đơn nào ở trạng thái đang lọc
**Then** hiện `EmptyState` theo EXPERIENCE.md

**Given** mỗi tab
**Then** hiển thị số đơn của trạng thái đó; mỗi dòng có `data-testid="admin-order-row"`, mỗi tab `data-testid="admin-status-tab"`

**Given** `GET /api/admin/orders` không có xác thực
**Then** 401 `UNAUTHORIZED`

### Story 2.3: Chi tiết đơn và thao tác chuyển trạng thái

As a nhân viên cửa hàng,
I want mở một đơn và chuyển nó sang bước kế tiếp hoặc hủy kèm ghi chú,
So that tôi xử lý xong đơn trong vài cú bấm mà không bấm nhầm.

Ràng buộc: AD-4, AD-9, AD-10, UX-DR2, UX-DR3, UX-DR4. Trang `/admin/orders/[id]`, Client Component `TransitionActions` gọi `PATCH /api/admin/orders/:id` bằng cookie phiên. Story này **tạo** `StatusTimeline` (`src/features/orders/components/status-timeline.tsx`, prop `variant: "staff" | "customer"`); Story 4.1 dùng lại.

**Acceptance Criteria:**

**Given** đơn `pending`
**Then** chỉ có nút "Xác nhận đơn" (primary) và "Hủy đơn"; đơn `shipping` chỉ có "Đánh dấu Đã giao"; đơn `delivered`/`cancelled` không có nút nào và hiện "Đơn đã {nhãn}, không còn thao tác nào."

**Given** bấm "Xác nhận đơn"
**Then** nút bị vô hiệu trong lúc gửi; thành công hiện "Đã chuyển đơn sang Đã xác nhận." (`role="status"`), badge và lịch sử cập nhật

**Given** bấm "Hủy đơn"
**Then** hiện hộp xác nhận "Hủy đơn {mã}? Thao tác này không hoàn tác được."; chỉ khi bấm "Xác nhận hủy" mới gửi yêu cầu

**Given** API trả 409 với `details.currentStatus = "cancelled"` khi đang xác nhận
**Then** hiện "Đơn đã ở trạng thái Đã hủy, không thể chuyển sang Đã xác nhận." (`role="alert"`) và trang tải lại trạng thái mới

**Given** API trả lỗi khác 409 `INVALID_STATUS_TRANSITION` (ví dụ 400 `VALIDATION_ERROR`)
**Then** ActionMessage hiện nguyên văn `message` của server, không hiện mã lỗi

**Given** ghi chú 201 ký tự (sau khi bỏ khoảng trắng hai đầu)
**Then** bộ đếm hiện "201/200" màu rose và nút gửi bị vô hiệu

**Given** phiên hết hạn khi bấm nút
**Then** chuyển tới `/admin/login?next=/admin/orders/{mã}`

**Given** trang chi tiết
**Then** lịch sử hiển thị bằng `StatusTimeline` `variant="staff"`: mỗi bước có nhãn trạng thái, thời điểm, người thực hiện ("Khách hàng" / "Nhân viên" / "Hệ thống") và ghi chú

---

## Epic 3: Tồn kho thật

Mục tiêu: số tồn kho trên web khớp hàng thật trong kho; không bao giờ bán vượt.

**FRs covered:** FR-10, FR-11, FR-12

### Story 3.1: Trừ kho khi xác nhận, hoàn kho khi hủy

As a chủ cửa hàng,
I want tồn kho giảm khi đơn được xác nhận và tăng lại khi đơn đã xác nhận bị hủy,
So that web không bán món hàng đã hết.

Ràng buộc: AD-6, AD-7, NFR-1. `InventoryRepository` (`storage/inventory.json`, `INVENTORY_FILE`), giá trị mặc định lấy từ `src/data/products.ts`; mọi thao tác chạy trong `writeQueue` chung của Story 1.3.

**Acceptance Criteria:**

**Given** sản phẩm còn 5, đơn `pending` có 2 sản phẩm đó
**When** nhân viên xác nhận đơn
**Then** tồn kho còn 3

**Given** đơn có 2 dòng, một dòng thiếu hàng (còn 1, cần 2)
**When** xác nhận
**Then** bị từ chối với `INSUFFICIENT_STOCK` (409), `details.productId`, message đúng câu hiện có của `placeOrder`: "Sản phẩm "{tên}" chỉ còn {N} sản phẩm" (còn 0: "Sản phẩm "{tên}" đã hết hàng")
**And** đơn vẫn `pending`, tồn kho **mọi** sản phẩm không đổi, lịch sử không thêm mục
**And** bấm "Xác nhận đơn" trên trang vận hành thì ActionMessage hiện đúng câu đó

**Given** đơn `confirmed` có 2 sản phẩm
**When** nhân viên hủy đơn
**Then** tồn kho tăng lại 2

**Given** đơn `pending` (chưa từng trừ kho)
**When** khách hoặc nhân viên hủy đơn
**Then** tồn kho **không** thay đổi

**Given** đơn `confirmed`
**When** chuyển sang `shipping` rồi `delivered`
**Then** tồn kho không thay đổi thêm

**Given** hai yêu cầu xác nhận hai đơn khác nhau **đồng thời** cho sản phẩm còn 1, mỗi đơn cần 1 (`Promise.allSettled`)
**Then** đúng một đơn được xác nhận, đơn còn lại nhận `INSUFFICIENT_STOCK`, tồn kho = 0 (không âm)

**Given** `storage/inventory.json` chưa tồn tại
**Then** đọc trả giá trị từ `products.ts`; lần ghi đầu tạo file (test dùng thư mục tạm)

### Story 3.2: Đặt hàng và catalog dùng tồn kho thật

As a khách hàng,
I want thấy đúng số hàng còn lại và không đặt được hàng đã hết,
So that tôi không bị hủy đơn sau khi đặt.

Ràng buộc: AD-6. `placeOrder` đọc tồn kho qua `InventoryRepository` (bên trong `writeQueue`); trang danh sách, trang chi tiết, `StockBadge`, giới hạn số lượng thêm vào giỏ dùng tồn kho thật truyền từ Server Component.

**Acceptance Criteria:**

**Given** tồn kho thật của "Giá đỡ laptop nhôm" là 1 (`products.ts` ghi 3)
**When** khách đặt 2
**Then** bị từ chối với `INSUFFICIENT_STOCK` "Sản phẩm "Giá đỡ laptop nhôm" chỉ còn 1 sản phẩm"

**Given** tồn kho thật là 0
**Then** trang sản phẩm hiện "Hết hàng" và nút "Thêm vào giỏ" bị vô hiệu

**Given** tồn kho thật là 4 (≤ `LOW_STOCK_THRESHOLD`)
**Then** `StockBadge` hiện "Chỉ còn 4 sản phẩm"

**Given** khách đặt hàng thành công
**Then** tồn kho **không** bị trừ (chỉ trừ khi xác nhận)

**And** `e2e/shopping-flow.spec.ts` vẫn pass với `ORDERS_FILE`, `INVENTORY_FILE` trỏ vào thư mục tạm

---

## Epic 4: Khách theo dõi tiến trình đơn

Mục tiêu: khách thấy đơn của mình đang ở bước nào mà không phải gọi cửa hàng.

**FRs covered:** FR-13, FR-14

### Story 4.1: Timeline trạng thái ở trang chi tiết đơn

As a khách hàng,
I want xem các bước đơn đã đi qua kèm thời điểm,
So that tôi biết đơn đang ở đâu.

Ràng buộc: AD-5, UX-DR4. Dùng lại `StatusTimeline` (tạo ở Story 2.3) với `variant="customer"`.

**Acceptance Criteria:**

**Given** đơn đã qua `pending → confirmed → shipping`
**When** khách mở `/orders/[id]`
**Then** thẻ "Tiến trình đơn hàng" (`data-testid="order-timeline"`) có 3 bước (`order-timeline-step`) theo thứ tự, mỗi bước có nhãn tiếng Việt và thời điểm `formatDateTime`
**And** bước cuối có chữ "Hiện tại"

**Given** đơn bị nhân viên hủy kèm ghi chú
**Then** bước "Đã hủy" hiện người thực hiện "Cửa hàng" và **không** hiện ghi chú

**Given** đơn cũ không có lịch sử
**Then** timeline có đúng một bước (trạng thái hiện tại, "Hệ thống"), trang không lỗi

**Given** vừa đặt hàng (`/orders/{id}?placed=1`)
**Then** banner "Đặt hàng thành công!" giữ nguyên và timeline có một bước "Chờ xác nhận"

**And** `e2e/shopping-flow.spec.ts`, `e2e/wishlist.spec.ts` pass không sửa nhãn hay `data-testid` hiện có
