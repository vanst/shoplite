import type { ReactNode } from "react";
import type { MaskedRecipient } from "../mask-order";

/** Phần ký tự che chỉ để nhìn; trình đọc màn hình nghe câu sr-only thay thế. */
function Masked({ shown, spoken }: { shown: string; spoken: string }) {
  return (
    <>
      <span aria-hidden="true">{shown}</span>
      <span className="sr-only">{spoken}</span>
    </>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="mt-1 flex gap-2">
      <dt className="w-28 shrink-0 text-slate-500">{label}</dt>
      <dd className="text-slate-800">{children}</dd>
    </div>
  );
}

export function MaskedRecipientCard({ recipient }: { recipient: MaskedRecipient }) {
  const { name, phone, email, area } = recipient;
  const domain = email?.slice(email.lastIndexOf("@") + 1);
  return (
    <div
      data-testid="masked-recipient"
      className="rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200"
    >
      <h2 className="mb-2 text-base font-semibold">Người nhận</h2>
      <dl>
        {name && <Row label="Người nhận">{name}</Row>}
        {phone && (
          <Row label="Số điện thoại">
            <Masked shown={phone} spoken={`kết thúc bằng ${phone.slice(-4)}`} />
          </Row>
        )}
        {email && (
          <Row label="Email">
            <Masked
              shown={email}
              spoken={`bắt đầu bằng ${Array.from(email)[0]}, tên miền ${domain}`}
            />
          </Row>
        )}
        {area && <Row label="Khu vực">{area}</Row>}
      </dl>
    </div>
  );
}
