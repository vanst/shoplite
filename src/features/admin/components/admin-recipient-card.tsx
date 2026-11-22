import type { ReactNode } from "react";
import type { OrderCustomer } from "@/features/orders/types";

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-1 flex gap-2">
      <dt className="w-28 shrink-0 text-slate-600">{label}</dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}

/** Thẻ "Người nhận" của nhân viên: đủ PII. Chỉ render trong trang đã qua requireAdmin. */
export function AdminRecipientCard({ customer }: { customer: OrderCustomer }) {
  return (
    <div
      data-testid="admin-recipient"
      className="rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200"
    >
      <h2 className="mb-2 text-base font-semibold">Người nhận</h2>
      <dl>
        <Row label="Họ tên">{customer.fullName}</Row>
        <Row label="Số điện thoại">
          <a
            href={`tel:${customer.phone}`}
            className="text-indigo-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600"
          >
            {customer.phone}
          </a>
        </Row>
        {customer.email && <Row label="Email">{customer.email}</Row>}
        <Row label="Địa chỉ">{customer.address}</Row>
        {customer.note && (
          <Row label="Ghi chú">
            <em>{customer.note}</em>
          </Row>
        )}
      </dl>
    </div>
  );
}
