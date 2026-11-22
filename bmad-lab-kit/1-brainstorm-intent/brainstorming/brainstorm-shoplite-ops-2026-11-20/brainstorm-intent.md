---
type: brainstorm-intent
topic: ShopLite Ops - công cụ vận hành đơn hàng cho nhân viên cửa hàng
source: .memlog.md (brainstorm-shoplite-ops-2026-11-20) + phan-bien.md (party mode + pre-mortem, 2026-11-20)
date: 2026-11-20
revision: 2 (bổ sung "Rủi ro đã nhận diện" sau bài 4.3)
facilitation: Creative Partner
techniques: Role Playing, How Might We, Reverse Brainstorming
converge: MoSCoW (Must tối đa 5 mục)
target: bmad-product-brief, bmad-prd
---

# Ý định: ShopLite Ops - vận hành đơn hàng

## 1. Vấn đề

ShopLite hiện chỉ có phía khách hàng. Đọc code cho thấy:

- `ORDER_STATUSES` đã có đủ 5 trạng thái (`pending`, `confirmed`, `shipping`, `delivered`, `cancelled` - `src/features/orders/types.ts`) nhưng **không có luồng chuyển** nào ngoài khách tự hủy: `PATCH /api/orders/:id` chỉ nhận `{ "status": "cancelled" }` khi đơn `pending`. Đơn đặt xong nằm mãi ở "Chờ xác nhận".
- `stock` là dữ liệu tĩnh trong `src/data/products.ts`. `placeOrder` có kiểm tra tồn kho nhưng **không trừ kho**, nên web không bao giờ báo hết hàng cho món đã bán hết.
- Đơn chỉ có `updatedAt`, **không có lịch sử**: không ai biết đơn bị hủy lúc nào, do ai, vì sao.
- `createJsonFileOrderRepository` đọc - sửa - ghi cả file `orders.json` và dùng chung một file `orders.json.tmp` → hai thao tác ghi cùng lúc có thể làm mất đơn.

## 2. Người dùng & nhu cầu cốt lõi

- **Nhân viên vận hành (chị Hoa, làm một mình, ~60 đơn/ngày):** mỗi sáng biết ngay đơn nào đang chờ, xác nhận - giao - hủy đơn trong vài thao tác, không phải mở file hay nhờ dev.
- **Khách hàng (anh Minh):** biết đơn của mình đang ở bước nào và từ lúc nào, không phải gọi điện hỏi.
- **Chủ cửa hàng (anh Tuấn):** số tồn kho trên web khớp hàng thật; truy vết được ai đổi trạng thái đơn, lúc nào.

## 3. Phạm vi MVP (MoSCoW)

**Must** (5 mục, làm được trên codebase hiện tại, không cần dịch vụ ngoài)

- **M1 - Vòng đời đơn có kiểm soát.** Chỉ cho phép các bước chuyển hợp lệ: `pending → confirmed | cancelled`, `confirmed → shipping | cancelled`, `shipping → delivered`; `delivered`, `cancelled` là trạng thái cuối. Mỗi lần đổi trạng thái ghi **lịch sử** (trạng thái, thời điểm, ai làm, ghi chú). Khách vẫn **chỉ hủy được đơn `pending`**.
- **M2 - API cho nhân viên đổi trạng thái**, bảo vệ bằng khóa bí mật trong biến môi trường. Thiếu khóa thì **từ chối mọi yêu cầu** (fail-closed).
- **M3 - Trang vận hành `/admin/orders`:** đăng nhập bằng mật khẩu cửa hàng, danh sách đơn lọc theo trạng thái (đơn chờ lâu nhất lên đầu), chi tiết đơn chỉ hiện nút cho bước hợp lệ kế tiếp, hủy đơn phải xác nhận lần hai.
- **M4 - Tồn kho thật:** trừ kho khi nhân viên **xác nhận** đơn, hoàn kho khi hủy đơn **đã xác nhận**; không bao giờ bán vượt hay để tồn kho âm, kể cả khi hai thao tác xảy ra cùng lúc. Catalog hiển thị tồn kho thật.
- **M5 - Khách xem tiến trình đơn** (timeline) ở `/orders/[id]`.

**Should:** xác nhận hàng loạt; in phiếu giao hàng; ngày giao dự kiến; cảnh báo sản phẩm sắp hết.

**Could:** tài khoản riêng cho từng nhân viên; dashboard doanh thu cho chủ shop; gửi SMS/email khi đơn đổi trạng thái.

**Won't (lần này):** che thông tin cá nhân / tra cứu đơn riêng tư (sáng kiến riêng); database thật; trả hàng - hoàn tiền; nhập hàng qua giao diện; trạng thái mới (giao thất bại, hoàn hàng).

## 4. Quyết định đã chốt

- **Trừ kho khi nhân viên xác nhận**, không giữ hàng lúc khách đặt. Lúc đặt vẫn kiểm tra tồn kho (thật) như hiện nay.
- **Thiếu hàng khi xác nhận → từ chối cả đơn** (`INSUFFICIENT_STOCK`), đơn giữ `pending`. Không xác nhận một phần.
- **Hủy đơn `confirmed` hoàn kho; hủy đơn `pending` không đụng tới kho** (chưa từng trừ).
- **Nhân viên hủy được đơn `pending` và `confirmed`**; đơn `shipping` không hủy được ở MVP.
- **Không thêm trạng thái mới**, dùng đúng 5 trạng thái có sẵn và nhãn tiếng Việt hiện có.
- **Một mật khẩu cửa hàng chung** (biến môi trường) cho trang vận hành; một khóa API riêng cho công cụ gọi API. Không có tài khoản từng người ở MVP.
- **Tồn kho lưu ở `storage/inventory.json`**, giá trị ban đầu lấy từ `stock` trong `src/data/products.ts` khi file chưa có. Không thêm database.
- **Đơn cũ trong `storage/orders.json` (chưa có lịch sử) vẫn xem và thao tác được**; đọc đơn không được tự ghi lại file.
- **Chạy một tiến trình** (như hiện nay); chống ghi đồng thời trong phạm vi một tiến trình là đủ.

## 5. Rủi ro đã nhận diện

| #   | Rủi ro                                                                                          | Chặn bằng                                                                       |
| --- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| R1  | Hai nhân viên/tab xác nhận cùng lúc hai đơn cần món cuối cùng → **bán vượt**, tồn kho âm        | Tuần tự hóa đọc - kiểm tra - trừ kho - lưu đơn (M4)                             |
| R2  | Ghi `orders.json` đồng thời (khách đặt + nhân viên xác nhận) → **mất đơn**                      | Cùng cơ chế tuần tự hóa với R1                                                  |
| R3  | Thiếu biến môi trường khóa/mật khẩu → API nhân viên **mở cho mọi người** (fail-open)            | Fail-closed + test riêng (M2)                                                   |
| R4  | Bấm "Xác nhận" hai lần → ghi lịch sử hai lần, **trừ kho hai lần**                               | Chuyển sang chính trạng thái hiện tại là không hợp lệ (M1)                      |
| R5  | Hủy đơn `pending` mà vẫn hoàn kho → tồn kho **tăng ảo**                                         | Chỉ hoàn kho khi đơn đã từng bị trừ kho (M4)                                    |
| R6  | Luồng khách tự hủy (có từ trước) không đi qua quy tắc mới → đơn hủy **không có lịch sử**        | Mọi thay đổi trạng thái, kể cả của khách, đi qua một chỗ duy nhất (M1)          |
| R7  | Đơn cũ không có trường lịch sử làm **vỡ trang** chi tiết / timeline                             | Suy ra lịch sử khi đọc, không ghi lại file (M1, M5)                             |
| R8  | Số `stock` ban đầu trong `products.ts` lệch hàng thật → "từ chối khi hết hàng" sai ngay ngày đầu | Chủ shop đối chiếu số trước khi bật tính năng (checklist vận hành, không phải code) |

## 6. Thước đo thành công (tuần đầu)

- 0 đơn bị bán vượt tồn kho; không sản phẩm nào có tồn kho âm.
- 0 đơn bị mất hoặc bị ghi đè trạng thái.
- Đơn `pending` được xác nhận hoặc hủy trong vòng 4 giờ làm việc.
- Chị Hoa xử lý một đơn bình thường (mở → xác nhận) trong tối đa 3 thao tác.
- Không tăng tỉ lệ đơn bị hủy vì hết hàng sau khi xác nhận (chỉ số không được xấu đi).

## 7. Câu hỏi còn mở cho PRD

- Ghi chú khi nhân viên hủy đơn có bắt buộc không? (đề xuất: khuyến khích, không bắt buộc ở MVP)
- Phiên đăng nhập trang vận hành kéo dài bao lâu? (đề xuất: 8 giờ - một ca làm việc)
- Catalog và giới hạn số lượng trong giỏ có đọc tồn kho thật ngay ở MVP không, hay chỉ chặn lúc đặt hàng?
- Khách thấy ghi chú hủy đơn của nhân viên trên timeline không?

## 8. Ràng buộc hiện có phải giữ nguyên

- Khách chỉ hủy được đơn `pending` (`cancelOrder`), ngược lại `INVALID_STATUS_TRANSITION` (409); `PATCH /api/orders/:id` của khách chỉ nhận `{ "status": "cancelled" }`.
- Giá, phí ship, giảm giá do server tính; không thêm trường tiền vào `placeOrderSchema`.
- Lỗi nghiệp vụ dùng `OrderError` + `HTTP_STATUS_BY_CODE`, trả về dạng `{ error: { code, message, details? } }`.
- Không đọc/ghi `storage/orders.json` trực tiếp, luôn qua `OrderRepository`; không import module server vào Client Component.
- Text UI, thông báo lỗi, tên test viết bằng tiếng Việt; E2E hiện có (`e2e/shopping-flow.spec.ts`, `e2e/wishlist.spec.ts`) phải tiếp tục pass.
