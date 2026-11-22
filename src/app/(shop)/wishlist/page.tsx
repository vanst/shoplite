import type { Metadata } from "next";
import { inventoryService } from "@/features/inventory/server";
import { WishlistView } from "@/features/wishlist/components/wishlist-view";

export const metadata: Metadata = { title: "Danh sách yêu thích" };

export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold">Danh sách yêu thích</h1>
      <WishlistView products={await inventoryService.getStockedProducts()} />
    </div>
  );
}
