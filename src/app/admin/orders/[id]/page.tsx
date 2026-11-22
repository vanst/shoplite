import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAdmin, type AdminContext } from "@/features/admin/admin-guard";
import { AdminOrderDetail } from "@/features/admin/components/admin-order-detail";
import { getPendingQuantities } from "@/features/admin/queue-rules";
import { inventoryService } from "@/features/inventory/server";
import { canonicalOrderId } from "@/features/order-access/order-id";
import { OrderError } from "@/features/orders/order-errors";
import { orderService } from "@/features/orders/server";

export const dynamic = "force-dynamic";

/** Title chỉ lấy từ URL, không đọc đơn nên không chứa PII. */
export async function generateMetadata({
  params,
}: PageProps<"/admin/orders/[id]">): Promise<Metadata> {
  const { id } = await params;
  return { title: `Đơn hàng ${safeDecode(id)} · Quản trị` };
}

function safeDecode(id: string): string {
  try {
    return decodeURIComponent(id);
  } catch {
    return id;
  }
}

/** Mã đơn quá dài (400) coi như không tồn tại: trang không có mã lỗi riêng. */
async function loadOrder(ctx: AdminContext, id: string) {
  try {
    return await orderService.getOrderForStaff(ctx, canonicalOrderId(safeDecode(id)));
  } catch (error) {
    const missing =
      error instanceof OrderError && ["ORDER_NOT_FOUND", "VALIDATION_ERROR"].includes(error.code);
    if (missing) notFound();
    throw error;
  }
}

export default async function AdminOrderPage({ params }: PageProps<"/admin/orders/[id]">) {
  const ctx = await requireAdmin(`/admin/orders/${(await params).id}`);
  const order = await loadOrder(ctx, (await params).id);
  const productIds = order.items.map((item) => item.productId);
  const isPending = order.status === "pending";
  const stock = isPending ? await inventoryService.getRawStockFor(productIds) : undefined;
  const pendingOthers = isPending
    ? getPendingQuantities(await orderService.listOrders(ctx), productIds, order.id)
    : undefined;
  return (
    <AdminOrderDetail order={order} now={new Date()} stock={stock} pendingOthers={pendingOthers} />
  );
}
