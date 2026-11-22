import { GuestShell } from "@/components/layout/guest-shell";

export default function ShopLayout({ children }: LayoutProps<"/">) {
  return <GuestShell>{children}</GuestShell>;
}
