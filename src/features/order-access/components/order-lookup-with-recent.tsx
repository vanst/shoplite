"use client";

import { useRef, useState } from "react";
import { OrderLookupForm } from "./order-lookup-form";
import { RecentOrdersOnDevice } from "./recent-orders-on-device";

/** Giữ giá trị ô Mã đơn và ref ô xác minh để form tra cứu và danh sách mã gần đây dùng chung. */
export function OrderLookupWithRecent({ initialOrderId = "" }: { initialOrderId?: string }) {
  const [orderId, setOrderId] = useState(initialOrderId);
  const verificationRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <OrderLookupForm
        orderId={orderId}
        onOrderIdChange={setOrderId}
        verificationRef={verificationRef}
      />
      <RecentOrdersOnDevice
        onPick={(id) => {
          setOrderId(id);
          verificationRef.current?.focus();
        }}
      />
    </>
  );
}
