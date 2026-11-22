import type { ReactNode } from "react";
import { Footer } from "./footer";
import { Header } from "./header";

/** Khung khách (Header + Footer); dùng cho nhóm route (shop) và trang not-found gốc. */
export function GuestShell({ children }: { children: ReactNode }) {
  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
