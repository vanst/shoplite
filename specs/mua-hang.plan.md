# Kế hoạch kiểm thử ShopLite: giỏ hàng và đặt hàng

## Application Overview

ShopLite là cửa hàng đồ công nghệ mini (Next.js). Kế hoạch phủ 7 tiêu chí trong specs/tieu-chi.md: GH-1 tới GH-4 (giỏ hàng, giới hạn số lượng, phí giao hàng quanh ngưỡng 500.000đ) và DH-1 tới DH-3 (form thanh toán, đặt hàng thành công, hủy đơn). Giỏ hàng lưu trong localStorage nên mỗi kịch bản bắt đầu với giỏ trống. Đơn hàng lưu trong storage/orders.json dùng chung với dev server, vì vậy kịch bản nào kiểm đơn hàng phải lọc theo mã đơn của chính nó. Tên kịch bản bắt đầu bằng mã tiêu chí; test sinh ra phải mang tag tương ứng, ví dụ { tag: '@GH-4' }. Mỗi kịch bản một file vì generator ghi đè file trùng tên; riêng 1.1 và 1.2 đã viết tay ở bài 6.2 nên dùng chung một file và không sinh lại.

## Test Scenarios

### 1. Giỏ hàng và phí giao hàng

**Seed:** `e2e/seed.spec.ts`

#### 1.1. GH-1 thêm sản phẩm còn hàng: giỏ hàng hiện đúng số lượng đã chọn

**File:** `e2e/gio-hang/them-san-pham.spec.ts`

**Steps:**

1. Mở /products/chuot-khong-day-swiftclick
2. Trong khối mua hàng, bấm "Tăng số lượng" 2 lần rồi bấm "Thêm vào giỏ" - expect: Link giỏ hàng ở đầu trang có tên "Giỏ hàng (3 sản phẩm)"
3. Bấm link giỏ hàng - expect: Có đúng 1 dòng trong giỏ, là Chuột không dây SwiftClick - expect: Ô số lượng của dòng đó bằng 3

#### 1.2. GH-1 sản phẩm hết hàng: không có cách nào thêm vào giỏ

**File:** `e2e/gio-hang/them-san-pham.spec.ts`

**Steps:**

1. Mở /products?category=am-thanh - expect: Thẻ "Micro thu âm PodCast USB" có nút "Hết hàng" bị vô hiệu
2. Bấm tên sản phẩm "Micro thu âm PodCast USB" - expect: Trang hiện "Sản phẩm tạm hết hàng. Vui lòng quay lại sau." - expect: Không có khối chọn số lượng và nút "Thêm vào giỏ"

#### 1.3. GH-2 không chọn được nhiều hơn số hàng còn trong kho

**File:** `e2e/gio-hang/gioi-han-ton-kho.spec.ts`

**Steps:**

1. Mở /products/gia-do-laptop-nhom - expect: Trang hiện "Chỉ còn 3 sản phẩm"
2. Bấm "Tăng số lượng" 2 lần - expect: Ô số lượng bằng 3 - expect: Nút "Tăng số lượng" bị vô hiệu
3. Bấm "Thêm vào giỏ" - expect: Link giỏ hàng có tên "Giỏ hàng (3 sản phẩm)" - expect: Khối mua hàng hiện "Bạn đã có số lượng tối đa của sản phẩm này trong giỏ." - expect: Nút mua đổi thành "Tối đa" và bị vô hiệu

#### 1.4. GH-2 tối đa 10 sản phẩm mỗi loại dù kho còn nhiều

**File:** `e2e/gio-hang/toi-da-10-moi-loai.spec.ts`

**Steps:**

1. Mở /products/cap-usb-c-ben-du-2m
2. Gõ 15 vào ô số lượng - expect: Ô số lượng tự về 10 - expect: Nút "Tăng số lượng" bị vô hiệu

#### 1.5. GH-3 dưới 500.000đ: tính phí 30.000đ và gợi ý số tiền cần mua thêm

**File:** `e2e/gio-hang/phi-duoi-nguong.spec.ts`

**Steps:**

1. Thêm 1 Cáp USB-C bện dù 2m (150.000đ) vào giỏ rồi mở /cart - expect: Khối tóm tắt hiện "Mua thêm 350.000 ₫ để được miễn phí giao hàng" - expect: Phí giao hàng (tiêu chuẩn) là 30.000 ₫ - expect: Tổng cộng 180.000 ₫

#### 1.6. GH-4 đúng 500.000đ: miễn phí giao hàng ở giỏ hàng và trang thanh toán

**File:** `e2e/gio-hang/mien-phi-dung-nguong.spec.ts`

**Steps:**

1. Thêm 2 Bàn di chuột cỡ lớn DeskMat XL (2 × 250.000đ) vào giỏ rồi mở /cart - expect: Khối tóm tắt hiện "Đơn hàng của bạn được miễn phí giao hàng tiêu chuẩn" - expect: Phí giao hàng (tiêu chuẩn) là "Miễn phí" - expect: Tổng cộng 500.000 ₫
2. Bấm "Tiến hành thanh toán" - expect: Phí giao hàng là "Miễn phí" - expect: Tổng thanh toán 500.000 ₫

### 2. Thanh toán và đơn hàng

**Seed:** `e2e/seed.spec.ts`

#### 2.1. DH-1 gửi form trống: báo lỗi từng ô bắt buộc và không tạo đơn

**File:** `e2e/dat-hang/form-trong.spec.ts`

**Steps:**

1. Thêm 1 Cáp USB-C vào giỏ, mở /checkout
2. Bấm "Đặt hàng" khi chưa điền gì - expect: Hiện "Họ tên phải có ít nhất 2 ký tự" - expect: Hiện "Số điện thoại không hợp lệ (ví dụ: 0912345678)" - expect: Hiện "Địa chỉ phải có ít nhất 10 ký tự" - expect: Vẫn ở /checkout, trình duyệt không gửi POST /api/orders

#### 2.2. DH-1 số điện thoại sai định dạng: chỉ ô đó báo lỗi

**File:** `e2e/dat-hang/so-dien-thoai-sai.spec.ts`

**Steps:**

1. Thêm 1 Cáp USB-C vào giỏ, mở /checkout, điền họ tên và địa chỉ hợp lệ, số điện thoại 0123456789
2. Bấm "Đặt hàng" - expect: Chỉ ô số điện thoại báo lỗi và được đánh dấu aria-invalid - expect: Vẫn ở /checkout

#### 2.3. DH-2 đặt hàng giao nhanh: đơn mới đúng tổng tiền, giỏ trống, có trong danh sách đơn

**File:** `e2e/dat-hang/dat-hang-giao-nhanh.spec.ts`

**Steps:**

1. Thêm 1 Chuột không dây SwiftClick (450.000đ) vào giỏ, mở /checkout, điền thông tin hợp lệ
2. Chọn "Giao hàng nhanh" - expect: Phí giao hàng 60.000 ₫, tổng thanh toán 510.000 ₫
3. Bấm "Đặt hàng" - expect: URL có dạng /orders/SL-YYYYMMDD-XXXXXX?placed=1 - expect: Hiện "Đặt hàng thành công!", tiêu đề đơn có "Chờ xác nhận", tổng 510.000 ₫ - expect: Biểu tượng giỏ hàng không còn số - expect: GET /api/orders/<mã đơn> trả subtotal 450000, shippingFee 60000, total 510000
4. Bấm "Tất cả đơn hàng" - expect: Dòng có mã đơn vừa đặt hiện "Chờ xác nhận" và 510.000 ₫

#### 2.4. DH-3 hủy đơn chờ xác nhận: phải xác nhận lần hai, trạng thái đổi ngay không cần tải lại

**File:** `e2e/dat-hang/huy-don-xac-nhan-hai-lan.spec.ts`

**Steps:**

1. Tạo một đơn qua POST /api/orders, mở /orders/<mã đơn> - expect: Tiêu đề có "Chờ xác nhận"
2. Bấm "Hủy đơn hàng" rồi bấm "Không" - expect: Đã hiện câu hỏi "Bạn chắc chắn muốn hủy đơn hàng này?" - expect: Tiêu đề vẫn "Chờ xác nhận"
3. Bấm "Hủy đơn hàng" rồi "Xác nhận hủy" - expect: PATCH /api/orders/<mã đơn> trả 200 - expect: Không tải lại trang, tiêu đề đổi thành "Đã hủy" - expect: Nút "Hủy đơn hàng" biến mất

#### 2.5. DH-3 đơn đã hủy không hủy lại được

**File:** `e2e/dat-hang/khong-huy-lai-don-da-huy.spec.ts`

**Steps:**

1. Tạo một đơn qua POST /api/orders, hủy bằng PATCH /api/orders/<mã đơn> với { status: "cancelled" } - expect: Trả 200
2. Gửi lại đúng lệnh hủy đó - expect: Trả 409 với error.code "INVALID_STATUS_TRANSITION"
