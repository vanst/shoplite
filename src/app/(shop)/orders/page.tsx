import type { Metadata } from "next";
import { OrderLookupPanel } from "@/features/order-access/components/order-lookup-panel";

export const metadata: Metadata = { title: "Tra cứu đơn" };

export default function OrderLookupPage() {
  return (
    <OrderLookupPanel
      showRecent
      description="Nhập mã đơn và 4 số cuối số điện thoại đã dùng khi đặt hàng."
    />
  );
}
