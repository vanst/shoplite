# Epic 1 Context: Vòng đời đơn hàng có kiểm soát

<!-- Compiled from planning artifacts. Edit freely. Regenerate with compile-epic-context if planning docs change. -->

## Goal

Đơn hàng ShopLite hiện không có luồng chuyển trạng thái nào ngoài khách tự hủy đơn Chờ xác nhận, và không có lịch sử. Epic này đưa mọi thay đổi trạng thái - của khách lẫn nhân viên - qua một quy tắc chung, ghi lịch sử cho từng lần đổi, và mở một API an toàn để nhân viên (và trang vận hành ở epic sau) đổi trạng thái. Epic tự đứng được: kiểm chứng bằng unit test và `curl`.

## Stories

- Story 1.1: Máy trạng thái đơn hàng
- Story 1.2: Lịch sử trạng thái đơn
- Story 1.3: API chuyển trạng thái cho nhân viên

## Requirements & Constraints

- Đúng 5 bước chuyển hợp lệ: `pending → confirmed`, `pending → cancelled`, `confirmed → shipping`, `confirmed → cancelled`, `shipping → delivered`. `delivered` và `cancelled` là trạng thái cuối. Chuyển sang chính trạng thái hiện tại là không hợp lệ (chặn bấm đúp).
- Khách chỉ có một thao tác: hủy đơn `pending`. Hành vi khách hiện có giữ nguyên hoàn toàn: mã lỗi `INVALID_STATUS_TRANSITION`, HTTP 409, thông báo "Chỉ có thể hủy đơn hàng đang ở trạng thái Chờ xác nhận" (nút Hủy đơn của khách hiển thị nguyên văn), body `PATCH /api/orders/:id` chỉ `{ "status": "cancelled" }`.
- Từ chối chuyển trạng thái phải kèm `details.currentStatus` để giao diện chọn câu thông báo đúng.
- Mỗi lần đổi trạng thái ghi đúng một mục lịch sử `{ status, at, actor, note? }`; ghi chú tối đa 200 ký tự sau khi bỏ khoảng trắng hai đầu, chỉ khoảng trắng = không có ghi chú.
- Đơn cũ trong `storage/orders.json` không có lịch sử vẫn đọc, liệt kê, chuyển trạng thái được; đọc không được ghi lại file.
- API nhân viên fail-closed: thiếu hoặc rỗng biến môi trường khóa → luôn 401, kể cả header `Bearer undefined`; so sánh timing-safe.
- Hai yêu cầu đổi trạng thái cùng một đơn đồng thời: đúng một thành công.

## Technical Decisions

- Logic nằm trong `src/features/orders/`; route handler trong `src/app/` chỉ đọc request, gọi một hàm, trả response.
- Một hàm thuần duy nhất `transitionOrder(order, to, { actor, at, note })` trong `order-state-machine.ts` tạo đơn có trạng thái mới; tra bảng `ALLOWED_TRANSITIONS`; người thực hiện `customer` chỉ được `pending → cancelled`. Hàm không mutate đơn đầu vào. `cancelOrder` của khách phải dùng hàm này.
- Người thực hiện: `customer` (đặt đơn, khách hủy), `staff` (mọi đường `/api/admin/**`), `system` (chỉ cho mục suy ra từ đơn cũ).
- Lịch sử là trường `statusHistory?` trong bản ghi đơn (không file riêng). `placeOrder` tạo mục đầu `pending` với `at = createdAt`. Đơn thiếu trường được chuẩn hóa bằng một hàm thuần ở **mọi** đường đọc của service thành một mục `{ status: <hiện tại>, at: updatedAt, actor: "system" }`; không lưu lại. Mục cuối luôn trùng trạng thái hiện tại.
- Một thao tác dùng một lần `now()` cho cả `updatedAt` và `at`.
- Lỗi nghiệp vụ ném `OrderError(code, message, details?)`; mã mới duy nhất của epic là `UNAUTHORIZED` (401), thêm vào `OrderErrorCode` và `HTTP_STATUS_BY_CODE`.
- API nhân viên: `PATCH /api/admin/orders/:id`, body `{ status, note? }` validate bằng Zod trong file mới `src/features/orders/order-schema.ts` (cập nhật `AGENTS.md`); xác thực qua `requireStaff(request)` trong `src/features/staff/staff-auth.ts`.
- Chống ghi đồng thời: `createWriteQueue()` (promise chain) tạo đúng một instance trong `server.ts`, truyền vào service, bọc toàn bộ chu trình đọc - kiểm tra - lưu của `placeOrder`, `cancelOrder`, `changeStatusByStaff`. Chỉ đúng trong một tiến trình.
- Test ma trận chuyển trạng thái dùng bảng kỳ vọng viết tay, không dùng lại `ALLOWED_TRANSITIONS` làm đáp án. Test service dùng `createInMemoryOrderRepository` và `now` cố định; test đồng thời dùng `Promise.allSettled`.

## Cross-Story Dependencies

- 1.2 mở rộng chữ ký `transitionOrder` của 1.1 (thêm `note`, ghi lịch sử).
- 1.3 dùng `transitionOrder` (1.1) và lịch sử (1.2); hàng đợi ghi của 1.3 được Epic 3 (tồn kho) dùng lại.
- Epic 2 (trang vận hành) gọi API của 1.3; Epic 4 (timeline) đọc lịch sử của 1.2.
