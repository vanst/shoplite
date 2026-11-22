# Phản biện ý tưởng ShopLite Ops

Nguồn: `/bmad-party-mode --mode subagent` (John, Sally, Winston, Amelia, Mary) và
`/bmad-advanced-elicitation` (Pre-mortem Analysis, Assumption Audit) trên `brainstorm-intent.md`, 2026-11-20.

## 1. Top 5 rủi ro

| #   | Rủi ro                                                                                                                                                                                                                                                     | Ai nêu           | Mức     |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------- | ------- |
| 1   | **Bán vượt tồn kho khi xác nhận đồng thời.** `order-repository.ts` đọc - sửa - ghi cả file; nếu trừ kho theo cùng kiểu, hai request xác nhận hai đơn cùng cần món cuối (Giá đỡ laptop `p011` chỉ còn 3) đều đọc thấy "còn hàng" và cùng trừ → tồn kho âm. | Winston          | Cao     |
| 2   | **Fail-open khi thiếu biến môi trường.** So sánh kiểu ``header === `Bearer ${process.env.STAFF_API_KEY}` `` sẽ cho qua header `Bearer undefined` khi server quên đặt khóa - lộ toàn bộ thao tác nhân viên.                                                    | Amelia           | Cao     |
| 3   | **Luồng cũ không đi qua quy tắc mới.** `cancelOrder` hiện tự gán `status: "cancelled"`. Thêm máy trạng thái và lịch sử mà quên sửa chỗ này thì đơn khách tự hủy không có lịch sử, mọi test cũ vẫn xanh.                                                      | Amelia, Winston  | Trung bình |
| 4   | **Đơn cũ thiếu trường lịch sử.** `storage/orders.json` trên máy dev đã có đơn thật; timeline đọc `statusHistory` không tồn tại sẽ làm vỡ trang chi tiết đơn.                                                                                               | Mary             | Trung bình |
| 5   | **Nhân viên không biết vì sao thao tác bị từ chối.** Bấm đúp, hai tab, hoặc khách vừa hủy đơn → API trả 409; nếu UI hiện mã lỗi thô, chị Hoa sẽ bấm lại liên tục.                                                                                            | Sally            | Trung bình |

Rủi ro bổ sung từ Pre-mortem ("6 tháng sau tính năng thất bại"):

- Số `stock` ban đầu chưa đối chiếu với kho thật → web báo hết hàng sai, khách bỏ đi (Mary).
- MVP quá to cho một sprint: 5 mục Must chạm cả API, UI, dữ liệu (John) → chia epic sao cho Epic 1 (vòng đời + API) tự đứng được.

## 2. Bất đồng chưa giải quyết

- **Giữ hàng lúc đặt hay trừ lúc xác nhận?** John muốn giữ hàng ngay lúc đặt để khách không bị hủy sau; Winston và Amelia muốn trừ lúc xác nhận vì đơn ảo (COD, không đăng nhập) sẽ khóa hàng của khách thật. → Chủ sản phẩm chọn **trừ lúc xác nhận** (xem mục 3); John vẫn lo tỉ lệ hủy vì hết hàng → đưa thành counter-metric.
- **Proxy hay kiểm tra trong từng route?** Winston muốn `src/proxy.ts` chặn `/admin/*`; Amelia nhắc proxy chỉ là lớp tiện lợi, API vẫn phải tự kiểm tra quyền. → Để Architect chốt ở bài 4.6.
- **Khách có thấy ghi chú hủy của nhân viên không?** Sally muốn hiện để khách hiểu; Mary lo nhân viên ghi chú nội bộ lộ ra ngoài. → Câu hỏi mở cho PRD.

## 3. Quyết định đã chốt trong buổi thảo luận

1. Trừ kho khi nhân viên **xác nhận** đơn; hủy đơn đã xác nhận thì hoàn kho; hủy đơn `pending` không đụng kho.
2. Thiếu hàng khi xác nhận → **từ chối cả đơn**, không xác nhận một phần.
3. Mọi thay đổi trạng thái (khách và nhân viên) đi qua **một hàm duy nhất**; chuyển sang chính trạng thái hiện tại là không hợp lệ (chặn bấm đúp trừ kho hai lần).
4. Thiếu biến môi trường bí mật → **từ chối** (fail-closed), có test riêng.
5. Không thêm database; tồn kho ở `storage/inventory.json`; chạy một tiến trình.
6. Che thông tin cá nhân của khách là sáng kiến **riêng**, không gộp vào MVP này.
