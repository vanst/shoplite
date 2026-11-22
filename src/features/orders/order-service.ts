import { MAX_QUANTITY_PER_ITEM } from "@/features/cart/cart-reducer";
import { buildCatalogHref, parseCatalogQuery } from "@/features/catalog/catalog-rules";
import { getProductById } from "@/features/catalog/catalog-data";
import type { Product } from "@/features/catalog/types";
import {
  placeOrderSchema,
  toFieldErrors,
  VN_PHONE_REGEX,
} from "@/features/checkout/checkout-schema";
import { toQueueRow, type QueueRow } from "@/features/admin/queue-rules";
import { normalizePhone } from "@/features/order-access/phone";
import { calculateOrderTotals, calculateSubtotal } from "@/features/checkout/pricing";
import { toCouponOrderError } from "@/features/coupons/coupon-errors";
import { evaluateCoupon } from "@/features/coupons/coupon-rules";
import { findCouponByCode } from "@/features/coupons/coupon-service";
import type { Coupon } from "@/features/coupons/types";
import { maskOrder, type MaskedOrder } from "@/features/order-access/mask-order";
import { verifyLookup } from "@/features/order-access/verify-lookup";
import { clampStock, computeCurrentStocks, type StockBase } from "@/features/inventory/stock-rules";
import type { AdminContext } from "@/features/admin/admin-guard";
import { OrderError, ORDER_STATUS_CONFLICT_MESSAGE } from "./order-errors";
import type { OrderRepository } from "./order-repository";
import { transitionOrder } from "./order-transitions";
import type { CancelReason, Order, OrderItem, OrderStatus, StoredOrder } from "./types";

const MAX_ID_ATTEMPTS = 3;

/** Trạng thái kỳ vọng + đích nhân viên gửi (đã qua order-admin-schema ở route). */
export type StaffTransitionInput =
  | { from: OrderStatus; to: Exclude<OrderStatus, "cancelled"> }
  | { from: Exclude<OrderStatus, "confirmed">; to: "cancelled"; reason: CancelReason }
  /** Báo thiếu hàng: hủy đơn `confirmed` và ghi Điều chỉnh tồn cho món `productId`. */
  | { from: "confirmed"; to: "cancelled"; reason: "out_of_stock"; productId: string };

export interface OrderServiceDeps {
  repository: OrderRepository;
  findProduct?: (id: string) => Product | undefined;
  findCoupon?: (code: string) => Coupon | undefined;
  now?: () => Date;
  generateId?: (date: Date) => string;
}

/** Mã đơn hàng dạng SL-20261021-4F9A2C */
export function generateOrderId(date: Date): string {
  const ymd = date.toISOString().slice(0, 10).replace(/-/g, "");
  const random = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `SL-${ymd}-${random}`;
}

/** Gộp các dòng trùng productId: [{p1, 2}, {p1, 1}] -> [{p1, 3}] */
function mergeItems(items: { productId: string; quantity: number }[]) {
  const merged = new Map<string, number>();
  for (const item of items) {
    merged.set(item.productId, (merged.get(item.productId) ?? 0) + item.quantity);
  }
  return [...merged.entries()].map(([productId, quantity]) => ({ productId, quantity }));
}

/** Giá trị thô (có thể < 0) so với số đặt; thiếu thì ném 409 INSUFFICIENT_STOCK (không PII trong log). */
function assertStockAvailable(
  currentStocks: ReadonlyMap<string, number>,
  lines: readonly { productId: string; name: string; quantity: number }[],
) {
  for (const { productId, name, quantity } of lines) {
    const current = currentStocks.get(productId) ?? 0;
    if (quantity > current) {
      // Chỉ productId, không PII: nguồn đo SM-C2.
      console.warn(JSON.stringify({ event: "insufficient_stock", productId }));
      const available = clampStock(current);
      throw new OrderError(
        "INSUFFICIENT_STOCK",
        available === 0
          ? `Sản phẩm "${name}" đã hết hàng`
          : `Sản phẩm "${name}" chỉ còn ${available} sản phẩm`,
      );
    }
  }
}

export function createOrderService({
  repository,
  findProduct = getProductById,
  findCoupon = findCouponByCode,
  now = () => new Date(),
  generateId = generateOrderId,
}: OrderServiceDeps) {
  async function getOrder(id: string): Promise<StoredOrder> {
    const order = await repository.findById(id);
    if (!order) {
      throw new OrderError("ORDER_NOT_FOUND", `Không tìm thấy đơn hàng "${id}"`);
    }
    return order;
  }

  /** `maskOrder` kèm link danh mục của món đầu tiên khi nhân viên từ chối vì hết hàng; món không còn trong catalog thì không có link. */
  function mask(order: StoredOrder): MaskedOrder {
    const category =
      order.cancelledBy === "staff" && order.cancelReason === "out_of_stock"
        ? findProduct(order.items[0]?.productId ?? "")?.categorySlug
        : undefined;
    return maskOrder(order, category && buildCatalogHref(parseCatalogQuery({}), { category }));
  }

  return {
    /**
     * Tạo đơn hàng mới từ payload của client.
     * - Validate dữ liệu bằng placeOrderSchema
     * - Lấy giá từ catalog (bỏ qua mọi giá client gửi lên)
     * - Kiểm tra Tồn hiện tại (Tồn gốc trừ đơn đã xác nhận) trong transaction
     * - Kiểm tra lại mã giảm giá và tự tính số tiền giảm (bỏ qua mọi số tiền client gửi lên)
     */
    async placeOrder(input: unknown): Promise<MaskedOrder> {
      const parsed = placeOrderSchema.safeParse(input);
      if (!parsed.success) {
        throw new OrderError(
          "VALIDATION_ERROR",
          "Thông tin đơn hàng không hợp lệ",
          toFieldErrors(parsed.error),
        );
      }

      const { customer, items, shippingMethod, paymentMethod, couponCode } = parsed.data;

      const mergedItems = mergeItems(items);
      // Sau khi gộp dòng trùng vẫn phải tuân giới hạn mỗi sản phẩm (FR-023) - không thể dùng
      // dòng trùng để vượt giới hạn hay đẩy tạm tính lên mức tối thiểu của mã giảm giá.
      if (mergedItems.some((item) => item.quantity > MAX_QUANTITY_PER_ITEM)) {
        throw new OrderError("VALIDATION_ERROR", "Thông tin đơn hàng không hợp lệ", {
          items: `Mỗi sản phẩm tối đa ${MAX_QUANTITY_PER_ITEM} sản phẩm`,
        });
      }

      // Tồn gốc từ catalog; Tồn hiện tại tính trong transaction từ các đơn đã ghi.
      const stockBases: (StockBase & { name: string })[] = [];
      const orderItems: OrderItem[] = mergedItems.map(({ productId, quantity }) => {
        const product = findProduct(productId);
        if (!product) {
          throw new OrderError("PRODUCT_NOT_FOUND", `Không tìm thấy sản phẩm "${productId}"`);
        }
        stockBases.push({ id: product.id, stock: product.stock, name: product.name });
        return {
          productId: product.id,
          slug: product.slug,
          name: product.name,
          image: product.image,
          unitPrice: product.price,
          quantity,
          lineTotal: product.price * quantity,
        };
      });

      // Một thời điểm duy nhất (đồng hồ server) cho cả việc xét hạn mã và thời điểm tạo đơn
      const createdAt = now();

      let discount = 0;
      // Mã sai vẫn phải đứng SAU kiểm tồn (tối đa -> tồn -> mã giảm giá) nên chỉ ném trong transaction.
      let couponFailure: OrderError | undefined;
      if (couponCode) {
        const evaluation = evaluateCoupon(
          findCoupon(couponCode),
          calculateSubtotal(orderItems),
          createdAt,
        );
        // Mã không hợp lệ: từ chối đơn, KHÔNG tự tạo đơn không giảm giá (FR-019)
        if (evaluation.status === "invalid") couponFailure = toCouponOrderError(evaluation);
        else discount = evaluation.discount;
      }

      const draft: Omit<Order, "id"> = {
        status: "pending",
        createdAt: createdAt.toISOString(),
        updatedAt: createdAt.toISOString(),
        statusHistory: [{ status: "pending", at: createdAt.toISOString() }],
        customer: {
          fullName: customer.fullName,
          phone: customer.phone,
          email: customer.email || undefined,
          address: customer.address,
          note: customer.note || undefined,
        },
        shippingMethod,
        paymentMethod,
        items: orderItems,
        ...(couponCode ? { couponCode } : {}),
        ...calculateOrderTotals(orderItems, shippingMethod, discount),
      };

      // Kiểm trùng mã và ghi nằm trong cùng transaction; trùng thì thử lại tối đa 3 lần.
      const saved = await repository.transaction(async (tx) => {
        // Kiểm tồn nằm cùng transaction với save: giá trị thô, đơn pending không giữ kho.
        assertStockAvailable(
          computeCurrentStocks(stockBases, await tx.findAll()),
          stockBases.map(({ id, name }) => ({
            productId: id,
            name,
            quantity: mergedItems.find((item) => item.productId === id)?.quantity ?? 0,
          })),
        );
        if (couponFailure) throw couponFailure;
        for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt++) {
          const id = generateId(createdAt);
          if (await tx.findById(id)) continue;
          const created: Order = { id, ...draft };
          await tx.save(created);
          return created;
        }
        throw new Error("Không tạo được mã đơn hàng duy nhất");
      });
      return mask(saved);
    },

    /** Danh sách đơn đầy đủ cho nhân viên, mới nhất trước. */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars -- ctx chỉ để buộc có AdminContext
    async listOrders(_ctx: AdminContext): Promise<StoredOrder[]> {
      const orders = await repository.findAll();
      return [...orders].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    },

    /**
     * Tìm đơn theo SĐT (khớp chính xác sau `normalizePhone`), mọi trạng thái, mới nhất trước.
     * Trả QueueRow (không PII); SĐT không hợp lệ thì rỗng, không lỗi.
     */
    async searchByPhone(_ctx: AdminContext, phone: string): Promise<QueueRow[]> {
      const wanted = normalizePhone(phone);
      if (!VN_PHONE_REGEX.test(wanted)) return [];
      const at = now();
      const orders = await repository.findAll();
      return orders
        .filter((o) => normalizePhone(o.customer.phone) === wanted)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .map((o) => toQueueRow(o, at));
    },

    /** Đơn đầy đủ cho nhân viên. Không có hàm tương đương cho khách: khách chỉ nhận MaskedOrder. */
    async getOrderForStaff(_ctx: AdminContext, id: string): Promise<StoredOrder> {
      return getOrder(id);
    },

    /**
     * Nhân viên chuyển đơn một bước. Thứ tự kiểm cố định, trong một transaction: không tồn tại (404)
     * -> `from` lệch trạng thái đang lưu (ORDER_STATUS_CONFLICT) -> cặp không hợp lệ -> khi sang
     * confirmed, dòng vượt Tồn hiện tại (INSUFFICIENT_STOCK). Chỉ confirmed trừ kho.
     */
    async transitionByStaff(
      _ctx: AdminContext,
      id: string,
      input: StaffTransitionInput,
    ): Promise<StoredOrder> {
      return repository.transaction(async (tx) => {
        const order = await tx.findById(id);
        if (!order) {
          throw new OrderError("ORDER_NOT_FOUND", `Không tìm thấy đơn hàng "${id}"`);
        }
        if (order.status !== input.from) {
          throw new OrderError("ORDER_STATUS_CONFLICT", ORDER_STATUS_CONFLICT_MESSAGE);
        }
        const next = transitionOrder(
          order,
          {
            actor: "staff",
            to: input.to,
            reason: "reason" in input ? input.reason : undefined,
            productId: "productId" in input ? input.productId : undefined,
          },
          now(),
        );
        if (input.to === "confirmed") {
          // Sản phẩm không còn trong catalog có Tồn gốc 0 (AD-4).
          const bases = order.items.map(({ productId }) => ({
            id: productId,
            stock: findProduct(productId)?.stock ?? 0,
          }));
          assertStockAvailable(
            computeCurrentStocks(bases, await tx.findAll()),
            order.items.map(({ productId, name, quantity }) => ({ productId, name, quantity })),
          );
        }
        await tx.save(next);
        return next;
      });
    },

    /** Đơn đã che; chỉ gọi sau khi đã kiểm grant. */
    async getMaskedOrder(id: string): Promise<MaskedOrder> {
      return mask(await getOrder(id));
    },

    /** Tra cứu của khách: đúng Mã xác minh thì trả bản che, sai hoặc không có đơn thì null (không phân biệt). */
    async lookupOrder(canonicalId: string, verification: string): Promise<MaskedOrder | null> {
      const order = await repository.findById(canonicalId);
      return verifyLookup(order ?? undefined, verification) && order ? mask(order) : null;
    },

    /** Khách hàng chỉ được hủy đơn khi đơn còn ở trạng thái "Chờ xác nhận". */
    async cancelOrder(id: string): Promise<MaskedOrder> {
      // Đọc, kiểm trạng thái và ghi trong một transaction: hai yêu cầu đồng thời chỉ một cái thắng.
      const cancelled = await repository.transaction(async (tx) => {
        const order = await tx.findById(id);
        if (!order) {
          throw new OrderError("ORDER_NOT_FOUND", `Không tìm thấy đơn hàng "${id}"`);
        }
        const next = transitionOrder(order, { actor: "customer", to: "cancelled" }, now());
        await tx.save(next);
        return next;
      });
      return mask(cancelled);
    },
  };
}

export type OrderService = ReturnType<typeof createOrderService>;
