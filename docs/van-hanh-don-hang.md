# Runbook vận hành đơn hàng

Dành cho chủ shop và người triển khai. Tính năng quản lý đơn chạy trên **một tiến trình Node duy nhất** với file đơn JSON.

## 1. Bật tính năng

- Đặt `ADMIN_PASSWORD` (không rỗng) trong môi trường của tiến trình. Để trống hoặc không đặt thì toàn bộ `/admin*` và API quản trị trả 404.
- Đặt `ORDERS_FILE` là **đường dẫn tuyệt đối nằm ngoài thư mục release**, ví dụ `/var/lib/shoplite/orders.json`, để deploy mới không xóa hoặc ghi đè đơn. Mặc định (`storage/orders.json` trong repo) chỉ dùng khi phát triển.
- Chạy `npm run build` rồi `npm run start`.

## 2. Hạ tầng bắt buộc

- Chạy **một** tiến trình, sau reverse proxy tin cậy, proxy phải nối IP khách vào `x-forwarded-for` (hệ thống lấy phần tử ngoài cùng bên phải). Không có proxy thì mọi khách chung một IP và dễ bị khóa nhầm.
- Không dùng serverless hay nhiều instance: bộ đếm khóa đăng nhập/tra cứu nằm trong bộ nhớ và repository giả định một người ghi.

## 3. Cutover

1. Dừng tiến trình cũ và chờ nó thoát hẳn.
2. Chỉ sau đó mới khởi động tiến trình mới (cùng `ORDERS_FILE`).
3. Không bao giờ để hai tiến trình chạy chồng nhau trên cùng file đơn: người ghi sau sẽ bị từ chối hoặc ghi đè dữ liệu.

## 4. Sao lưu và khôi phục

- Sao lưu: sao chép `ORDERS_FILE` khi đang chạy là an toàn (file được ghi ra `.tmp` rồi `rename`).
- Khôi phục: **dừng tiến trình** trước, chép bản sao lưu vào chỗ cũ, rồi khởi động lại.
- Lỗi "File dữ liệu đơn hàng bị hỏng, không thể đọc": hệ thống không tự ghi đè. Dừng tiến trình, giữ lại file hỏng để điều tra, khôi phục từ bản sao lưu gần nhất, khởi động lại.
- Lỗi "File đơn hàng đã bị thay đổi từ bên ngoài": có ai sửa file khi tiến trình chạy; lần ghi bị hủy để tránh mất dữ liệu. Khởi động lại tiến trình để nạp lại file.

## 5. Đơn tồn đọng (PRD §13)

Đơn `pending` tạo trước ngày bật là Đơn tồn đọng.

1. **Trước khi bật**, nhân viên rà các đơn `pending` quá hạn và **Từ chối từng đơn** (nút "Từ chối" trên đơn) với lý do phù hợp: "Hết hàng", "Khách hủy" hoặc "Không liên lạc được". Không có Từ chối hàng loạt, đây là chủ ý.
2. Đơn nào còn lại vào ngày bật đều nằm ở tab **Chờ xác nhận** và đi qua luật Xác nhận thường (kiểm Tồn hiện tại), nên không làm âm kho.
3. Lưu ý: FR-10 sẽ **tô đỏ toàn bộ** đơn quá hạn 4 giờ ngay khi bật, kể cả các Đơn tồn đọng chưa kịp xử lý.

## 6. Đo chỉ số thành công

Số liệu lấy bằng hàm `computeOrderMetrics(orders, now)` trong `src/features/admin/order-metrics.ts` (thuần, không có giao diện; gọi từ test hoặc script riêng với danh sách đơn từ `OrderRepository`). Đơn cũ thiếu `cancelledBy` và Khách tự hủy không tính vào SM-1.

| Chỉ số | Định nghĩa                                                                                                | Mục tiêu | Nguồn                                                     |
| ------ | --------------------------------------------------------------------------------------------------------- | -------- | --------------------------------------------------------- |
| SM-1   | Số đơn Từ chối "Hết hàng" (gồm Báo thiếu hàng) / tổng đơn đã tạo                                          | < 5%     | File đơn                                                  |
| SM-2   | Số sản phẩm có tổng số lượng ở `confirmed`/`shipping`/`delivered` vượt Tồn gốc                            | 0        | File đơn                                                  |
| SM-3   | Số lần lộ PII cho người chưa xác minh/chưa đăng nhập                                                      | 0        | Test bảo mật trước ra mắt                                 |
| SM-4   | Tỉ lệ đơn được Xác nhận hoặc Từ chối trong 4 giờ kể từ lúc đặt (mẫu: đơn đã quyết định hoặc đã quá 4 giờ) | Theo dõi | `statusHistory`                                           |
| SM-C1  | Tỉ lệ Từ chối "Khách hủy" + "Không liên lạc được" / tổng đơn (đối trọng SM-1)                             | Theo dõi | File đơn                                                  |
| SM-C2  | Số lần khách bị chặn vì `INSUFFICIENT_STOCK`                                                              | Theo dõi | Dòng log `{"event":"insufficient_stock","productId":...}` |
| SM-C3  | Trung vị thời gian từ lúc đặt đến Xác nhận (đối trọng SM-4)                                               | Theo dõi | `statusHistory`                                           |

Theo PRD, ngưỡng SM-1 (5%) cần xem lại sau tuần đầu: với 100 đơn/ngày là khoảng 5 khách bị từ chối mỗi ngày.

## 7. Danh sách kiểm trước ra mắt

- [ ] `npm run check`
- [ ] `npm run format:check`
- [ ] `npm run test:e2e`
- [ ] `npm run smoke:shared-instance` (smoke `next dev` và `next start`, Story 3.2)
- [ ] `npm run verify:build` (kiểm `.next/prerender-manifest.json` không tĩnh hóa `/admin`, Story 1.5)
- [ ] Test quét guard (`admin-guard-coverage.test.ts`) và quét PII (`pii-scan.test.ts`) xanh
- [ ] `ADMIN_PASSWORD`, `ORDERS_FILE` đã đặt đúng; đã rà và Từ chối Đơn tồn đọng (mục 5)

**Rủi ro hạ tầng đã biết:** `npm audit` báo Next `16.0.0 – 16.4.4` có advisory mức moderate. Nâng cấp Next là việc hạ tầng, ngoài phạm vi tính năng này.
