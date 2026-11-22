import type { Metadata } from "next";
import { cookies } from "next/headers";
import Link from "next/link";
import { BackLink } from "@/components/ui/back-link";
import { ProductImage } from "@/features/catalog/components/product-image";
import { PAYMENT_OPTIONS } from "@/features/checkout/checkout-schema";
import { SHIPPING_OPTIONS } from "@/features/checkout/pricing";
import { CancelOrderButton } from "@/features/orders/components/cancel-order-button";
import { OrderStatusBadge } from "@/features/orders/components/order-status-badge";
import { OrderSuccessBanner } from "@/features/orders/components/order-success-banner";
import { OrderTimeline } from "@/features/orders/components/order-timeline";
import { RejectionNotice } from "@/features/orders/components/rejection-notice";
import { OrderTotals } from "@/features/orders/components/order-totals";
import { MaskedRecipientCard } from "@/features/order-access/components/masked-recipient-card";
import { OrderLookupPanel } from "@/features/order-access/components/order-lookup-panel";
import { canonicalOrderId } from "@/features/order-access/order-id";
import { getGrant, GRANT_COOKIE_NAME } from "@/features/order-access/order-grant";
import type { MaskedOrder } from "@/features/order-access/mask-order";
import { OrderError } from "@/features/orders/order-errors";
import { orderService } from "@/features/orders/server";
import { formatCurrency, formatDateTime } from "@/lib/format";

export const dynamic = "force-dynamic";

async function findOrder(id: string): Promise<MaskedOrder | null> {
  try {
    return await orderService.getMaskedOrder(id);
  } catch (error) {
    if (error instanceof OrderError && error.code === "ORDER_NOT_FOUND") return null;
    throw error;
  }
}

function safeCanonicalId(id: string): string {
  try {
    return canonicalOrderId(decodeURIComponent(id));
  } catch {
    return "";
  }
}

export async function generateMetadata({ params }: PageProps<"/orders/[id]">): Promise<Metadata> {
  return { title: `Đơn hàng ${(await params).id}` };
}

export default async function OrderDetailPage({ params }: PageProps<"/orders/[id]">) {
  const { id } = await params;
  // Không grant: form tra cứu (HTTP 200) giống hệt cho id có và không có đơn, không lộ đơn tồn tại
  const token = (await cookies()).get(GRANT_COOKIE_NAME)?.value;
  const grant = getGrant(token, id);
  const order = grant ? await findOrder(id) : null;
  if (!grant || !order) {
    return (
      <OrderLookupPanel
        description="Nhập 4 số cuối số điện thoại để xem đơn này."
        initialOrderId={safeCanonicalId(id)}
      />
    );
  }

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 px-4 py-8">
      <BackLink href="/orders">Tra cứu đơn khác</BackLink>

      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1
            tabIndex={-1}
            className="flex flex-wrap items-center gap-3 text-2xl font-bold outline-none"
          >
            Đơn hàng {order.id}
            <OrderStatusBadge status={order.status} />
          </h1>
          <p className="mt-1 text-sm text-slate-500">Đặt lúc {formatDateTime(order.createdAt)}</p>
        </div>
        {order.status === "pending" && <CancelOrderButton orderId={order.id} />}
      </header>

      {grant.via === "placed" && order.status === "pending" && (
        <OrderSuccessBanner orderId={order.id} />
      )}

      {order.status === "cancelled" && order.cancelledBy && (
        <RejectionNotice
          cancelledBy={order.cancelledBy}
          reasonLabel={order.cancelReasonLabel}
          categoryHref={order.categoryHref}
        />
      )}

      <OrderTimeline title="Hành trình đơn hàng" entries={order.timeline} />

      <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
        <h2 className="mb-2 text-lg font-semibold">Sản phẩm</h2>
        <ul className="divide-y divide-slate-100">
          {order.items.map((item) => (
            <li key={item.productId} className="flex items-center gap-4 py-3">
              <Link href={`/products/${item.slug}`} className="w-14 shrink-0">
                <ProductImage image={item.image} alt={item.name} size="sm" />
              </Link>
              <div className="flex-1">
                <Link href={`/products/${item.slug}`} className="font-medium hover:text-indigo-600">
                  {item.name}
                </Link>
                <p className="text-sm text-slate-500">
                  {formatCurrency(item.unitPrice)} × {item.quantity}
                </p>
              </div>
              <span className="font-semibold">{formatCurrency(item.lineTotal)}</span>
            </li>
          ))}
        </ul>
        <OrderTotals order={order} />
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <MaskedRecipientCard recipient={order.recipient} />
        <div className="rounded-2xl bg-white p-5 text-sm shadow-sm ring-1 ring-slate-200">
          <h2 className="mb-2 text-base font-semibold">Giao hàng & thanh toán</h2>
          <p>
            <span className="text-slate-500">Giao hàng: </span>
            {SHIPPING_OPTIONS[order.shippingMethod].label}
          </p>
          <p>
            <span className="text-slate-500">Thanh toán: </span>
            {PAYMENT_OPTIONS[order.paymentMethod].label}
          </p>
          {order.paymentMethod === "bank_transfer" && order.status === "pending" && (
            <p className="mt-3 rounded-xl bg-slate-50 p-3 text-slate-600">
              Vui lòng chuyển khoản {formatCurrency(order.total)} tới STK{" "}
              <strong>0123456789</strong> (Ngân hàng Demo) với nội dung <strong>{order.id}</strong>.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
