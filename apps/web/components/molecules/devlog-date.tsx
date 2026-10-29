import { formatPostDate } from "@/lib/format";
import { cn } from "@/lib/utils";

export type DevlogDateProps = { date: string; className?: string };

export function DevlogDate({ date, className }: DevlogDateProps) {
  return (
    <time
      dateTime={date}
      className={cn("font-mono text-[13px] text-faint", className)}
    >
      {formatPostDate(date)}
    </time>
  );
}
