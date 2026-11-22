import Link from "next/link";
import { cn } from "@/lib/cn";
import type { AdminTab } from "../queue-rules";

export const ADMIN_TAB_LABELS: Record<AdminTab, string> = {
  pending: "Chờ xác nhận",
  confirmed: "Đã xác nhận",
  shipping: "Đang giao",
  done: "Đã xong",
};

interface AdminTabsProps {
  active: AdminTab;
  counts: Record<AdminTab, number>;
}

export function AdminTabs({ active, counts }: AdminTabsProps) {
  return (
    <nav aria-label="Trạng thái đơn" className="min-w-0 overflow-x-auto">
      <ul className="flex gap-2">
        {(Object.keys(ADMIN_TAB_LABELS) as AdminTab[]).map((tab) => (
          <li key={tab} className="shrink-0">
            <Link
              href={`/admin?tab=${tab}`}
              aria-current={tab === active ? "page" : undefined}
              data-testid={`admin-tab-${tab}`}
              className={cn(
                "inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold ring-1 ring-inset",
                tab === active
                  ? "bg-indigo-600 text-white ring-indigo-600"
                  : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50",
              )}
            >
              {ADMIN_TAB_LABELS[tab]}
              <span data-testid="admin-tab-count" className="tabular-nums">
                {counts[tab]}
                <span className="sr-only"> đơn</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
