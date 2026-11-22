import { describe, expect, it } from "vitest";
import type { Order } from "@/features/orders/types";
import { maskOrder } from "./mask-order";

const baseOrder: Order = {
  id: "SL-20261121-A1B2C3",
  status: "pending",
  createdAt: "2026-11-21T03:00:00.000Z",
  updatedAt: "2026-11-21T03:00:00.000Z",
  customer: {
    fullName: "Nguyễn Thị Mai",
    phone: "+84912345678",
    email: "mai@gmail.com",
    address: "12 Lê Lợi, Quận 1, TP.HCM",
    note: "gọi trước",
  },
  shippingMethod: "standard",
  paymentMethod: "cod",
  items: [
    {
      productId: "p010",
      slug: "cap-usb-c",
      name: "Cáp USB-C",
      image: { emoji: "🔌", from: "#fff", to: "#000" },
      unitPrice: 150_000,
      quantity: 2,
      lineTotal: 300_000,
    },
  ],
  subtotal: 300_000,
  couponCode: "SHOPLITE10",
  discount: 30_000,
  shippingFee: 30_000,
  total: 300_000,
};

const withCustomer = (customer: Partial<Order["customer"]>): Order => ({
  ...baseOrder,
  customer: { ...baseOrder.customer, ...customer },
});

describe("maskOrder", () => {
  it("che SĐT, email, địa chỉ, tên và bỏ ghi chú", () => {
    const { recipient } = maskOrder(baseOrder);
    expect(recipient).toEqual({
      name: "Mai",
      phone: "•••••• 5678",
      email: "m•••@gmail.com",
      area: "TP.HCM",
    });
  });

  it("giữ nguyên tiền, món, phương thức, trạng thái, thời gian", () => {
    const masked: Record<string, unknown> = { ...maskOrder(baseOrder) };
    const expected: Record<string, unknown> = { ...baseOrder };
    delete masked.recipient;
    delete masked.timeline;
    delete expected.customer;
    expect(masked).toEqual(expected);
  });

  it("bỏ hẳn trường không rút được mảnh an toàn", () => {
    const { recipient } = maskOrder(
      withCustomer({ address: "12 Lê Lợi Quận 1", email: "khong-co-a-còng" }),
    );
    expect(recipient).not.toHaveProperty("area");
    expect(recipient).not.toHaveProperty("email");
    expect(maskOrder(withCustomer({ email: undefined })).recipient).not.toHaveProperty("email");
    expect(maskOrder(withCustomer({ address: "12 Lê Lợi," })).recipient).not.toHaveProperty("area");
  });

  it("họ tên một từ giữ nguyên; ký tự đầu email theo Unicode", () => {
    expect(maskOrder(withCustomer({ fullName: "Mai" })).recipient.name).toBe("Mai");
    expect(maskOrder(withCustomer({ email: "😀x@gmail.com" })).recipient.email).toBe(
      "😀•••@gmail.com",
    );
  });

  it("nhận đối tượng đóng băng sâu, không sửa đầu vào", () => {
    const frozen = structuredClone(baseOrder);
    Object.freeze(frozen.customer);
    frozen.items.forEach(Object.freeze);
    Object.freeze(frozen.items);
    Object.freeze(frozen);
    const masked = maskOrder(frozen);
    expect(masked).not.toBe(frozen);
    expect(frozen.customer.phone).toBe("+84912345678");
  });

  it("kiểu MaskedOrder không có customer và các trường cá nhân ở gốc", () => {
    const masked = maskOrder(baseOrder);
    // @ts-expect-error không có .customer
    void masked.customer;
    // @ts-expect-error không có .fullName
    void masked.fullName;
    // @ts-expect-error không có .phone
    void masked.phone;
    // @ts-expect-error không có .email
    void masked.email;
    // @ts-expect-error không có .address
    void masked.address;
    // @ts-expect-error không có .note
    void masked.note;
    expect(masked).not.toHaveProperty("customer");
  });

  it("JSON kết quả không chứa PII đầy đủ trên bộ đơn mẫu", () => {
    const samples = [
      baseOrder,
      withCustomer({ phone: "0912345678", address: "12 Lê Lợi Quận 1", email: undefined }),
      withCustomer({ fullName: "Trần Văn Hùng Dũng", email: "😀x@gmail.com" }),
    ];
    for (const order of samples) {
      const json = JSON.stringify(maskOrder(order));
      const { fullName, phone, email, address, note } = order.customer;
      for (const secret of [phone, "0912345678", "+84912345678", email, address, note, fullName]) {
        if (secret) expect(json).not.toContain(secret);
      }
    }
  });
  describe("lý do hủy và timeline", () => {
    const staffCancelled: Order = {
      ...baseOrder,
      status: "cancelled",
      updatedAt: "2026-11-21T04:00:00.000Z",
      cancelledBy: "staff",
      cancelReason: "out_of_stock",
      statusHistory: [
        { status: "pending", at: baseOrder.createdAt },
        { status: "cancelled", at: "2026-11-21T04:00:00.000Z" },
      ],
    };

    it("đơn bị từ chối: có nhãn lý do, không có mã thô, timeline Đặt hàng rồi Đã hủy", () => {
      const masked = maskOrder(staffCancelled);
      expect(masked.cancelledBy).toBe("staff");
      expect(masked.cancelReasonLabel).toBe("Hết hàng");
      expect(JSON.stringify(masked)).not.toContain("out_of_stock");
      expect(masked.timeline.map((e) => e.label)).toEqual(["Đặt hàng", "Đã hủy"]);
    });

    it("khách tự hủy: có cancelledBy, không có nhãn lý do", () => {
      const masked = maskOrder({
        ...staffCancelled,
        cancelledBy: "customer",
        cancelReason: undefined,
      });
      expect(masked.cancelledBy).toBe("customer");
      expect(masked).not.toHaveProperty("cancelReasonLabel");
    });

    it("đơn cũ thiếu người hủy: không có hai trường, timeline suy từ createdAt/updatedAt", () => {
      const masked = maskOrder({
        ...baseOrder,
        status: "cancelled",
        updatedAt: "2026-11-22T00:00:00.000Z",
      });
      expect(masked).not.toHaveProperty("cancelledBy");
      expect(masked).not.toHaveProperty("cancelReasonLabel");
      expect(masked.timeline).toEqual([
        { label: "Đặt hàng", at: baseOrder.createdAt },
        { label: "Đã hủy", at: "2026-11-22T00:00:00.000Z" },
      ]);
    });

    it("đơn chờ xác nhận chỉ có mốc Đặt hàng; categoryHref chỉ có khi được truyền", () => {
      expect(maskOrder(baseOrder).timeline).toHaveLength(1);
      expect(maskOrder(baseOrder)).not.toHaveProperty("categoryHref");
      expect(maskOrder(staffCancelled, "/products?category=am-thanh").categoryHref).toBe(
        "/products?category=am-thanh",
      );
    });
  });
});
