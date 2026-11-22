import { Clock } from "lucide-react";
import { cn } from "@/lib/cn";

interface PendingAgeProps {
  label: string;
  overdue: boolean;
}

/** Tuổi đơn đang chờ; quá hạn thì đậm đỏ kèm chữ cho trình đọc màn hình (không chỉ màu). */
export function PendingAge({ label, overdue }: PendingAgeProps) {
  return (
    <span
      data-testid={overdue ? "overdue-age" : undefined}
      className={cn(
        "inline-flex items-center gap-1 text-sm",
        overdue ? "font-semibold text-rose-700" : "text-slate-600",
      )}
    >
      <Clock className="size-4" aria-hidden />
      {overdue && <span className="sr-only">Quá hạn, </span>}
      {label}
    </span>
  );
}
