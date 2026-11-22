import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import type { TimelineView } from "../order-timeline";

/** Thẻ hành trình trạng thái (khách: "Hành trình đơn hàng", nhân viên: "Lịch sử trạng thái"). `entries` tăng dần, hiển thị mới nhất trên cùng. */
export function OrderTimeline({ title, entries }: { title: string; entries: TimelineView[] }) {
  const newestFirst = [...entries].reverse();
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      <ol aria-label="Hành trình đơn hàng, mới nhất trước" data-testid="status-timeline">
        {newestFirst.map((entry, i) => (
          <li
            key={`${entry.at}-${entry.label}`}
            data-testid="timeline-entry"
            aria-current={i === 0 ? "step" : undefined}
            className="relative border-l border-slate-200 pb-4 pl-5 last:border-transparent last:pb-0"
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-1 -left-[5.5px] size-2.5 rounded-full",
                i === 0 ? "bg-indigo-600" : "bg-slate-300",
              )}
            />
            <p className="text-sm font-medium text-slate-900">{entry.label}</p>
            <p className="text-xs text-slate-500">{formatDateTime(entry.at)}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
