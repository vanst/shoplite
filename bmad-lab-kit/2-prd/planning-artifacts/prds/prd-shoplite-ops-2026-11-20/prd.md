---
title: ShopLite Ops - Vận hành đơn hàng
status: final
created: 2026-11-20
updated: 2026-11-20
stakes: internal
form_factor: web responsive (desktop + mobile 390px)
inputs:
  - _bmad-output/brainstorming/brainstorm-shoplite-ops-2026-11-20/brainstorm-intent.md
  - _bmad-output/brainstorming/brainstorm-shoplite-ops-2026-11-20/phan-bien.md
  - AGENTS.md
companions:
  - addendum.md
---

# PRD: ShopLite Ops - Vận hành đơn hàng

## 0. Document Purpose

PRD này dành cho UX (`bmad-ux`), Architect (`bmad-architecture`), PM chia epic/story và Dev/QA của ShopLite. ShopLite là sản phẩm **đang chạy** (brownfield, Next.js 16): tài liệu tách rõ hành vi **MỚI** và hành vi **HIỆN CÓ phải giữ nguyên** (mục 4.6). Thuật ngữ dùng đúng như mục 3 Glossary; FR đánh số toàn cục FR-1..FR-14, hành trình UJ-1..UJ-3, thước đo SM-1..SM-4 và SM-C1. Mọi tham chiếu code đã được kiểm chứng trên nhánh hiện tại. Lựa chọn kỹ thuật đã nghe được và phương án bị loại nằm ở `addendum.md` (dành cho Architect). Không còn `[ASSUMPTION]` mở - các giả định đã được chủ sản phẩm xác nhận và liệt kê ở mục 9.

## 1. Vision

ShopLite bán được hàng nhưng chưa vận hành được đơn: đơn đặt xong nằm mãi ở "Chờ xác nhận", tồn kho trên web không bao giờ giảm, và không ai biết đơn bị hủy lúc nào, bởi ai. ShopLite Ops cho nhân viên cửa hàng một công cụ nhỏ để đưa đơn đi hết vòng đời - xác nhận, giao, hủy - với tồn kho phản ánh hàng thật.

Mỗi thay đổi trạng thái đi qua một quy tắc chung và để lại dấu vết trong lịch sử trạng thái. Nhờ đó cùng một dữ liệu phục vụ ba người: nhân viên biết việc tiếp theo, chủ cửa hàng truy vết được ai làm gì, khách thấy đơn của mình đang ở bước nào.

Tính năng giữ đúng tinh thần ShopLite: không database, không dịch vụ ngoài, dữ liệu trong `storage/`, chạy một tiến trình Node.

## 2. Target User

### 2.1 Jobs To Be Done

- **Nhân viên vận hành:** "Mỗi sáng, cho tôi biết đơn nào cần xử lý trước và cho tôi xử lý xong từng đơn trong vài cú bấm, không sợ bấm nhầm."
- **Chủ cửa hàng:** "Cho tôi tin rằng số tồn kho trên web là số thật, và khi khách khiếu nại thì tôi tra được đơn đã đi qua những bước nào, ai làm."
- **Khách hàng:** "Cho tôi biết đơn của tôi đang ở đâu mà không phải gọi điện."

### 2.2 Non-Users (v1)

- Kế toán, đơn vị vận chuyển, đối tác bên ngoài: không có quyền truy cập trang vận hành.
- Nhiều nhân viên với phân quyền khác nhau: MVP chỉ có một vai "nhân viên" dùng chung mật khẩu cửa hàng.

### 2.3 Key User Journeys

- **UJ-1. Chị Hoa dọn hàng việc buổi sáng.**
  - **Persona + context:** chị Hoa là nhân viên vận hành duy nhất của ShopLite, xử lý khoảng 60 đơn/ngày trên laptop ở kho.
  - **Entry state:** 8h sáng, chưa đăng nhập; mở `/admin/orders` → được chuyển tới `/admin/login`.
  - **Path:** nhập mật khẩu cửa hàng → danh sách đơn, mặc định lọc **Chờ xác nhận**, đơn chờ lâu nhất ở đầu, mỗi dòng có tuổi đơn → mở đơn đầu tiên, kiểm hàng trên kệ → bấm **Xác nhận đơn** → tồn kho giảm ngay, lịch sử thêm một dòng "Đã xác nhận · Nhân viên · 08:05".
  - **Climax:** chỉ trong vài phút 12 đơn chờ đã được xác nhận; chiều chị lọc **Đã xác nhận**, chuyển từng đơn sang **Đang giao** khi shipper tới lấy.
  - **Resolution:** hàng việc "Chờ xác nhận" trống; trang sản phẩm hiển thị đúng số còn lại.
  - **Edge case:** một đơn cần 2 Giá đỡ laptop nhưng kho chỉ còn 1 → bấm Xác nhận bị từ chối với câu "Sản phẩm "Giá đỡ laptop nhôm" chỉ còn 1 sản phẩm"; đơn vẫn Chờ xác nhận. Chị gọi khách rồi **Hủy đơn** kèm ghi chú "Hết hàng, khách đồng ý hủy" (hệ thống hỏi xác nhận lần hai).

- **UJ-2. Anh Minh xem đơn của mình đang đi tới đâu.**
  - **Persona + context:** anh Minh đặt một Bàn phím cơ KeyPro 75% hôm qua, thanh toán COD.
  - **Entry state:** mở `/orders`, bấm vào đơn của mình.
  - **Path:** trang chi tiết đơn hiển thị badge **Đang giao** và khối **Tiến trình đơn hàng**: Chờ xác nhận (hôm qua 20:14) → Đã xác nhận (08:05) → Đang giao (14:30).
  - **Climax:** anh biết đơn đã rời kho từ 14:30, không cần gọi cửa hàng.
  - **Resolution:** anh chờ shipper. Nút "Hủy đơn hàng" không còn hiện vì đơn không còn ở Chờ xác nhận.
  - **Edge case:** đơn đặt trước khi có tính năng này không có lịch sử chi tiết → timeline chỉ hiện trạng thái hiện tại tại thời điểm cập nhật cuối, trang không lỗi.

- **UJ-3. Hai thao tác cùng lúc trên một đơn.**
  - **Persona + context:** chị Hoa mở cùng một đơn ở hai tab; đồng thời khách của đơn đó tự hủy trên web.
  - **Entry state:** đơn đang Chờ xác nhận, sản phẩm còn đúng 1.
  - **Path:** khách bấm Hủy đơn → thành công. Ngay sau đó chị Hoa bấm Xác nhận ở tab cũ.
  - **Climax:** thao tác của chị bị từ chối với câu "Đơn đã ở trạng thái Đã hủy, không thể chuyển sang Đã xác nhận", trang tự tải lại trạng thái mới.
  - **Resolution:** tồn kho không bị trừ; lịch sử ghi đúng một lần hủy, người thực hiện là Khách hàng.
  - **Edge case:** chị bấm đúp nút Xác nhận trên một đơn → đơn chỉ được xác nhận một lần, kho chỉ trừ một lần, lần bấm thứ hai nhận thông báo "đã ở trạng thái Đã xác nhận".

## 3. Glossary

- **Đơn hàng (Order)** - bản ghi trong `OrderRepository` (`src/features/orders/types.ts`), có đúng một **Trạng thái đơn** tại mỗi thời điểm.
- **Trạng thái đơn (Order status)** - một trong 5 giá trị của `ORDER_STATUSES`: `pending` (Chờ xác nhận), `confirmed` (Đã xác nhận), `shipping` (Đang giao), `delivered` (Đã giao), `cancelled` (Đã hủy). Nhãn tiếng Việt lấy từ `ORDER_STATUS_LABELS`.
- **Trạng thái cuối (Terminal status)** - `delivered` và `cancelled`; không có bước chuyển nào ra khỏi trạng thái cuối.
- **Bước chuyển hợp lệ (Valid transition)** - một cặp (từ, sang) trong bảng: `pending → confirmed`, `pending → cancelled`, `confirmed → shipping`, `confirmed → cancelled`, `shipping → delivered`. Mọi cặp khác, kể cả chuyển sang chính trạng thái hiện tại, là không hợp lệ.
- **Người thực hiện (Actor)** - ai gây ra thay đổi trạng thái: `customer` (Khách hàng), `staff` (Nhân viên), hoặc `system` (Hệ thống, chỉ dùng cho mục lịch sử suy ra từ **Đơn cũ**). Nhãn hiển thị: **Trang vận hành** ghi "Khách hàng" / "Nhân viên" / "Hệ thống"; trang của khách ghi `staff` là "Cửa hàng".
- **Lịch sử trạng thái (Status history)** - danh sách chỉ ghi thêm các **Mục lịch sử**, theo thứ tự thời gian; mục cuối luôn trùng **Trạng thái đơn** hiện tại.
- **Mục lịch sử (History entry)** - `{ status, at, actor, note? }`: trạng thái mới, thời điểm (ISO 8601, đồng hồ server), **Người thực hiện**, **Ghi chú** tùy chọn.
- **Ghi chú (Note)** - văn bản tự do của nhân viên kèm một lần chuyển trạng thái. Độ dài luôn tính **sau khi bỏ khoảng trắng hai đầu**, tối đa 200 ký tự; chuỗi rỗng coi như không có.
- **Đơn cũ (Legacy order)** - đơn đã lưu trong `storage/orders.json` trước khi có **Lịch sử trạng thái**.
- **Nhân viên (Staff)** - người dùng trang vận hành hoặc API nhân viên; MVP không phân biệt từng người.
- **Khóa API nhân viên (Staff API key)** - bí mật trong biến môi trường `STAFF_API_KEY`, dùng cho công cụ gọi API nhân viên.
- **Mật khẩu cửa hàng (Shop password)** - bí mật trong biến môi trường `STAFF_PASSWORD`, dùng để đăng nhập **Trang vận hành**.
- **Phiên nhân viên (Staff session)** - trạng thái đã đăng nhập của trình duyệt trên **Trang vận hành**, hết hạn sau 8 giờ.
- **Trang vận hành (Staff console)** - các trang dưới `/admin` dành cho nhân viên.
- **Hàng việc (Order queue)** - danh sách đơn trên **Trang vận hành**, lọc theo một **Trạng thái đơn**.
- **Tuổi đơn (Order age)** - thời gian từ lúc đặt đơn tới hiện tại.
- **Tồn kho (Stock)** - số lượng còn bán được của một sản phẩm, lưu trong `storage/inventory.json`; giá trị khởi tạo lấy từ `stock` trong `src/data/products.ts`.
- **Trừ kho / Hoàn kho (Deduct / Restock)** - giảm / tăng **Tồn kho** theo số lượng từng dòng của một đơn.
- **Tiến trình đơn (Order timeline)** - hiển thị **Lịch sử trạng thái** cho khách ở trang chi tiết đơn.

## 4. Features

### 4.1 Vòng đời đơn hàng có kiểm soát

**Description:** Mọi thay đổi **Trạng thái đơn** - của khách hay của nhân viên - đi qua cùng một quy tắc **Bước chuyển hợp lệ** và ghi một **Mục lịch sử**. Khách giữ nguyên quyền hiện có: chỉ hủy được đơn Chờ xác nhận. Đơn cũ vẫn đọc và thao tác được. Realizes UJ-1, UJ-2, UJ-3.

**Functional Requirements:**

#### FR-1: Chỉ cho phép bước chuyển hợp lệ

Hệ thống chỉ cho phép đổi **Trạng thái đơn** theo bảng **Bước chuyển hợp lệ**. Realizes UJ-1, UJ-3.

**Consequences (testable):**

- `pending → confirmed`, `pending → cancelled`, `confirmed → shipping`, `confirmed → cancelled`, `shipping → delivered` thành công; đơn nhận trạng thái mới và `updatedAt` = thời điểm chuyển.
- Mọi cặp còn lại trong ma trận 5 × 5 bị từ chối với `INVALID_STATUS_TRANSITION` (409); đơn không thay đổi gì (kể cả `updatedAt`).
- Chuyển sang chính trạng thái hiện tại (ví dụ `confirmed → confirmed`) bị từ chối với `INVALID_STATUS_TRANSITION`.
- Lỗi `INVALID_STATUS_TRANSITION` có `details.currentStatus` = trạng thái thật của đơn, để giao diện chọn đúng câu thông báo.

#### FR-2: Khách chỉ hủy được đơn Chờ xác nhận (giữ nguyên)

**Khách hàng** chỉ có một thao tác: hủy đơn đang `pending`. Realizes UJ-2, UJ-3.

**Consequences (testable):**

- Khách hủy đơn `pending` → `cancelled`.
- Khách hủy đơn ở trạng thái khác → `INVALID_STATUS_TRANSITION` (409) với thông báo hiện có "Chỉ có thể hủy đơn hàng đang ở trạng thái Chờ xác nhận" (nút Hủy đơn của khách hiển thị nguyên văn câu này).
- `PATCH /api/orders/:id` chỉ chấp nhận body `{ "status": "cancelled" }`; body khác → 400 `VALIDATION_ERROR` như hiện nay.

#### FR-3: Ghi lịch sử mỗi lần đổi trạng thái

Mỗi lần **Trạng thái đơn** thay đổi, hệ thống ghi thêm đúng một **Mục lịch sử**. Realizes UJ-1, UJ-2.

**Consequences (testable):**

- Đơn vừa đặt có đúng 1 mục `{ status: "pending", at: createdAt, actor: "customer" }`.
- Mỗi bước chuyển hợp lệ thêm đúng 1 mục với `status` mới, `at` = `updatedAt` mới, `actor` và `note` (nếu có); các mục cũ không đổi.
- Mục cuối của **Lịch sử trạng thái** luôn có `status` trùng trạng thái hiện tại của đơn.
- **Ghi chú** dài hơn 200 ký tự (sau khi bỏ khoảng trắng hai đầu) bị từ chối với `VALIDATION_ERROR` (400); đúng 200 ký tự được chấp nhận; ghi chú chỉ có khoảng trắng coi như không có ghi chú.
- Bước chuyển bị từ chối không ghi mục nào.

#### FR-4: Đơn cũ vẫn đọc và thao tác được

**Đơn cũ** không có **Lịch sử trạng thái** vẫn hiển thị, liệt kê và chuyển trạng thái được. Realizes UJ-2.

**Consequences (testable):**

- Khi đọc (xem chi tiết hoặc liệt kê), **Đơn cũ** được trả về với lịch sử suy ra `[{ status: <trạng thái hiện tại>, at: updatedAt, actor: "system" }]`.
- Đọc đơn không ghi lại `storage/orders.json`.
- Chuyển trạng thái một **Đơn cũ** lưu lịch sử gồm mục suy ra + mục mới.

**Out of Scope:**

- Chạy script migrate toàn bộ file `orders.json`.

### 4.2 API nhân viên

**Description:** Công cụ của cửa hàng (và **Trang vận hành** ở mục 4.3) đổi trạng thái đơn qua một API riêng, tách khỏi API của khách. API luôn từ chối khi chưa cấu hình bí mật. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-5: Nhân viên đổi trạng thái đơn qua API

**Nhân viên** có thể gọi `PATCH /api/admin/orders/:id` với body `{ "status": <trạng thái>, "note"?: <chuỗi> }` để đổi trạng thái theo FR-1. Realizes UJ-1.

**Consequences (testable):**

- Bước chuyển hợp lệ → 200, trả về đơn đã cập nhật (gồm **Lịch sử trạng thái**, mục cuối `actor: "staff"`).
- Bước chuyển không hợp lệ → 409 `INVALID_STATUS_TRANSITION` kèm `details.currentStatus`.
- Mã đơn không tồn tại → 404 `ORDER_NOT_FOUND`.
- Body không phải JSON, `status` không thuộc `ORDER_STATUSES`, hoặc `note` không phải chuỗi / quá 200 ký tự → 400 `VALIDATION_ERROR`.

#### FR-6: API nhân viên chỉ mở cho người có quyền (fail-closed)

Chỉ yêu cầu có **Khóa API nhân viên** đúng (header `Authorization: Bearer <khóa>`) hoặc **Phiên nhân viên** hợp lệ mới được xử lý. Realizes UJ-1.

**Consequences (testable):**

- Thiếu header, sai khóa, hoặc **server chưa đặt `STAFF_API_KEY`** (kể cả khi client gửi `Bearer undefined`) → 401 `UNAUTHORIZED`, không đọc hay ghi đơn nào.
- So sánh khóa không lộ thông tin qua thời gian phản hồi (so sánh timing-safe).
- Mọi route dưới `/api/admin/` áp dụng cùng một kiểm tra, **trừ** `/api/admin/session` (đăng nhập/đăng xuất, FR-7); có test cho từng route còn lại trả 401 khi chưa xác thực.

### 4.3 Trang vận hành cho nhân viên

**Description:** Nhân viên làm việc hằng ngày trên giao diện thay vì gọi API bằng tay. Giao diện tiếng Việt, dùng lại design system hiện có, chạy tốt ở laptop và điện thoại 390px. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-7: Đăng nhập bằng mật khẩu cửa hàng

**Nhân viên** có thể đăng nhập **Trang vận hành** bằng **Mật khẩu cửa hàng** và đăng xuất. Realizes UJ-1.

**Consequences (testable):**

- Truy cập bất kỳ trang `/admin/*` (trừ `/admin/login`) khi chưa có **Phiên nhân viên** → chuyển tới `/admin/login`.
- Đúng mật khẩu → tạo **Phiên nhân viên** 8 giờ, chuyển tới `/admin/orders`; sai mật khẩu → thông báo "Mật khẩu không đúng", không tạo phiên.
- Server chưa đặt `STAFF_PASSWORD` → không ai đăng nhập được, trang báo "Trang vận hành chưa được cấu hình".
- Đăng xuất → trình duyệt mất **Phiên nhân viên** ngay (cookie bị xóa), quay về `/admin/login`. Cookie đã bị sao chép trước đó vẫn hợp lệ tới khi hết hạn 8 giờ - rủi ro chấp nhận ở MVP (không lưu phiên phía server).

#### FR-8: Hàng việc theo trạng thái

**Nhân viên** có thể xem **Hàng việc** lọc theo một **Trạng thái đơn**. Realizes UJ-1.

**Consequences (testable):**

- Mặc định lọc `pending`; bộ lọc nằm trên URL (`/admin/orders?status=confirmed`) để tải lại hoặc chia sẻ link vẫn đúng.
- Đơn `pending` và `confirmed` sắp xếp theo `createdAt` **cũ nhất trước** (chờ lâu nhất trước); các trạng thái khác `createdAt` mới nhất trước.
- Mỗi dòng có mã đơn, tên khách, số sản phẩm, tổng tiền, badge trạng thái và **Tuổi đơn** ("12 phút", "3 giờ", "2 ngày").
- Mỗi tab lọc hiển thị số đơn của trạng thái đó; danh sách rỗng có trạng thái rỗng thân thiện.

#### FR-9: Chi tiết đơn và thao tác chuyển trạng thái

**Nhân viên** có thể mở một đơn, xem đầy đủ thông tin, **Lịch sử trạng thái**, và chuyển sang bước hợp lệ kế tiếp. Realizes UJ-1, UJ-3.

**Consequences (testable):**

- Chỉ hiện nút cho các **Bước chuyển hợp lệ** từ trạng thái hiện tại (đơn `delivered`/`cancelled` không có nút nào).
- Hủy đơn cần xác nhận lần hai; có ô **Ghi chú** tùy chọn (giới hạn 200 ký tự, có bộ đếm).
- Khi API trả 409, giao diện hiện câu tiếng Việt theo `details.currentStatus` ("Đơn đã ở trạng thái Đã hủy, không thể chuyển sang Đã xác nhận") và tải lại trạng thái mới; không bao giờ hiện mã lỗi thô.
- Khi API trả lỗi khác (ví dụ `INSUFFICIENT_STOCK` từ FR-10, `VALIDATION_ERROR`), hiện nguyên văn `message` của server (câu đã nêu đích danh sản phẩm và số còn lại).
- Nút đang gửi bị vô hiệu cho tới khi có phản hồi (chặn bấm đúp ở giao diện; server vẫn chặn theo FR-1).

### 4.4 Tồn kho thật

**Description:** **Tồn kho** thành dữ liệu ghi được, giảm khi nhân viên xác nhận đơn và tăng lại khi đơn đã xác nhận bị hủy. Catalog và lúc đặt hàng dùng cùng con số. Realizes UJ-1, UJ-3.

**Functional Requirements:**

#### FR-10: Xác nhận đơn trừ kho

Khi đơn chuyển `pending → confirmed`, hệ thống **Trừ kho** mọi dòng của đơn. Realizes UJ-1.

**Consequences (testable):**

- Sản phẩm còn 5, đơn có 2 → sau khi xác nhận còn 3.
- Bất kỳ dòng nào thiếu hàng → từ chối cả đơn với `INSUFFICIENT_STOCK` (409) và `details.productId`, thông báo dùng đúng câu hiện có của `placeOrder` ("Sản phẩm "{tên}" chỉ còn {N} sản phẩm" / "Sản phẩm "{tên}" đã hết hàng"); đơn giữ `pending`; **Tồn kho** mọi sản phẩm không đổi.
- Hai yêu cầu xác nhận hai đơn khác nhau **đồng thời**, sản phẩm còn 1, mỗi đơn cần 1 → đúng một đơn được xác nhận, đơn còn lại nhận `INSUFFICIENT_STOCK`; **Tồn kho** = 0, không bao giờ âm.

#### FR-11: Hủy đơn đã xác nhận hoàn kho

Khi đơn chuyển `confirmed → cancelled`, hệ thống **Hoàn kho** mọi dòng của đơn. Realizes UJ-1.

**Consequences (testable):**

- Đơn `confirmed` có 2 sản phẩm bị hủy → **Tồn kho** tăng lại 2.
- Hủy đơn `pending` (chưa từng trừ kho), dù bởi khách hay nhân viên → **Tồn kho** không đổi.
- Bước chuyển bị từ chối không làm **Tồn kho** thay đổi.

#### FR-12: Đặt hàng và catalog dùng tồn kho thật

Khi khách đặt hàng và khi xem sản phẩm, hệ thống dùng **Tồn kho** trong `storage/inventory.json` thay cho số tĩnh. Realizes UJ-1.

**Consequences (testable):**

- `placeOrder` từ chối với `INSUFFICIENT_STOCK` khi số lượng đặt vượt **Tồn kho** hiện tại (thông báo hiện có "chỉ còn N sản phẩm" / "đã hết hàng" giữ nguyên).
- Trang danh sách, trang chi tiết sản phẩm, `StockBadge` và giới hạn số lượng khi thêm vào giỏ hiển thị **Tồn kho** thật.
- File `storage/inventory.json` chưa tồn tại → khởi tạo từ `stock` trong `src/data/products.ts` ở lần ghi đầu tiên; sản phẩm mới chưa có trong file dùng giá trị trong `products.ts`.
- Đặt hàng **không** trừ kho (giữ quyết định trừ khi xác nhận).

**Out of Scope:**

- Nhập hàng qua giao diện (chủ shop sửa `storage/inventory.json` khi server dừng, hoặc story sau).

### 4.5 Khách theo dõi tiến trình đơn

**Description:** Trang chi tiết đơn của khách hiển thị **Tiến trình đơn** dựng từ **Lịch sử trạng thái**. Realizes UJ-2.

**Functional Requirements:**

#### FR-13: Timeline ở trang chi tiết đơn

**Khách hàng** có thể xem các bước đơn đã đi qua kèm thời điểm ở `/orders/[id]`. Realizes UJ-2.

**Consequences (testable):**

- Mỗi **Mục lịch sử** là một bước: nhãn trạng thái tiếng Việt + thời điểm (`formatDateTime`); bước hiện tại được nhấn mạnh bằng chữ "Hiện tại", không chỉ bằng màu.
- Đơn `cancelled` hiển thị bước Đã hủy và **Người thực hiện** dạng "Khách hàng" / "Cửa hàng".
- **Ghi chú** của nhân viên **không** hiển thị cho khách (chỉ hiển thị ở **Trang vận hành**).
- **Đơn cũ** hiển thị một bước duy nhất theo lịch sử suy ra (FR-4); trang không lỗi.

#### FR-14: Tiến trình đơn không làm vỡ luồng mua hàng hiện có

**Consequences (testable):**

- `e2e/shopping-flow.spec.ts` và `e2e/wishlist.spec.ts` tiếp tục pass không cần sửa nhãn hay `data-testid` hiện có.
- Banner "Đặt hàng thành công!" sau khi đặt (`/orders/{id}?placed=1`) giữ nguyên.

### 4.6 Hành vi hiện có phải giữ nguyên

- Giá, phí ship, giảm giá do server tính trong `placeOrder` (`src/features/orders/order-service.ts`); `placeOrderSchema` chỉ nhận `productId` + `quantity` (+ `couponCode`).
- Giới hạn `MAX_QUANTITY_PER_ITEM = 10` và `getMaxQuantity(stock)` trong giỏ hàng.
- Quy tắc mã giảm giá, phí ship, ngưỡng miễn phí ship (`pricing.ts`) không đổi.
- Lỗi API giữ định dạng `{ error: { code, message, details? } }` qua `handleRouteError`; mã lỗi mới phải có trong `OrderErrorCode` + `HTTP_STATUS_BY_CODE`.
- Mọi truy cập đơn hàng đi qua `OrderRepository`; không import `@/features/orders/server` hay `node:*` vào Client Component.

## 5. Non-Goals (Explicit)

- Không xây hệ thống tài khoản: không có tài khoản khách, không có tài khoản riêng từng nhân viên.
- Không che hay giới hạn thông tin cá nhân của khách trên `/orders` (là một sáng kiến riêng; MVP này không làm tệ thêm vì không thêm đường lộ dữ liệu mới).
- Không thêm database hay dịch vụ ngoài (SMS, email, hàng đợi, Redis).
- Không thêm trạng thái mới (giao thất bại, hoàn hàng, trả hàng).
- Không hỗ trợ chạy nhiều tiến trình/instance ghi chung `storage/`.
- Không làm dashboard doanh thu hay báo cáo.

## 6. MVP Scope

### 6.1 In Scope

- FR-1 → FR-4: máy trạng thái, lịch sử, tương thích đơn cũ.
- FR-5, FR-6: API nhân viên fail-closed.
- FR-7 → FR-9: trang vận hành (đăng nhập, hàng việc, chi tiết + thao tác).
- FR-10 → FR-12: tồn kho thật.
- FR-13, FR-14: timeline cho khách, không phá luồng mua hàng.

### 6.2 Out of Scope for MVP

- Xác nhận hàng loạt - đợi đo SM-3 sau 2 tuần; nếu chị Hoa vẫn mất nhiều thao tác thì làm ở v2.
- In phiếu giao hàng, ngày giao dự kiến - v2.
- Cảnh báo sắp hết hàng cho chủ shop - v2 (đã có `StockBadge` "Chỉ còn N" cho khách).
- Nhập hàng qua giao diện - v2. `[NOTE FOR PM]` chủ shop sẽ phải sửa file khi nhập hàng; xem lại nếu nhập hàng nhiều hơn 1 lần/tuần.
- Hủy đơn đang giao (`shipping → cancelled`) - cần quy trình hoàn hàng, ngoài MVP.

## 7. Success Metrics

**Primary**

- **SM-1**: Tỉ lệ đơn `pending` được xác nhận hoặc hủy trong vòng 4 giờ làm việc - mục tiêu ≥ 90% trong 2 tuần đầu. Đo từ **Lịch sử trạng thái** (`at` của mục thứ hai trừ `createdAt`). Validates FR-1, FR-8, FR-9.
- **SM-2**: Số lần bán vượt tồn kho (tồn kho âm hoặc đơn `confirmed` khi thiếu hàng) - mục tiêu 0. Validates FR-10, FR-11, FR-12.

**Secondary**

- **SM-3**: Số thao tác để xử lý một đơn bình thường (mở → xác nhận) - mục tiêu ≤ 3. Validates FR-8, FR-9.
- **SM-4**: Số đơn bị mất hoặc bị ghi đè trạng thái - mục tiêu 0. Đo bằng: (a) kiểm tra bất biến hằng ngày trên `orders.json` (mục cuối của **Lịch sử trạng thái** trùng trạng thái, không có hai mục liên tiếp trùng trạng thái); (b) số phản ánh "đã đặt nhưng không thấy đơn" của khách. Validates FR-1, FR-3, FR-10.

**Counter-metrics (do not optimize)**

- **SM-C1**: Tỉ lệ đơn `pending` bị **nhân viên** hủy (mục lịch sử `cancelled`, `actor: "staff"`, ngay sau `pending`) trên tổng số đơn - không được tăng so với 2 tuần đầu sau ra mắt. Counterbalances SM-2: muốn SM-2 = 0 bằng cách hủy bớt đơn thay vì xác nhận thì SM-C1 sẽ xấu đi.

## 8. Open Questions

1. Có cần nhân viên nhập ghi chú bắt buộc khi hủy đơn không? MVP: không bắt buộc; xem lại sau khi đọc lịch sử 2 tuần đầu.
2. Khi nhập hàng nhiều hơn 1 lần/tuần, có cần màn hình nhập hàng không (v2)?
3. Khi có nhân viên thứ hai, chuyển sang tài khoản riêng từng người hay tiếp tục mật khẩu chung?

## 9. Assumptions Index

- §2.3 UJ-1 - một nhân viên, ~60 đơn/ngày, làm việc trên laptop; điện thoại 390px chỉ dùng xem nhanh. (đã xác nhận)
- §4.3 FR-7 - phiên đăng nhập 8 giờ là đủ cho một ca. (đã xác nhận)
- §4.4 FR-12 - số `stock` trong `src/data/products.ts` được chủ shop đối chiếu với kho thật trước khi bật tính năng. (đã xác nhận, là việc vận hành)
- §4.5 FR-13 - khách không cần thấy ghi chú nội bộ của nhân viên. (đã xác nhận)
- Toàn tài liệu - ShopLite chạy đúng một tiến trình Node ghi vào `storage/`. (đã xác nhận)
