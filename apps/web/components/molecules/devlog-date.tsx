import { cn } from "@/lib/utils";

const format = new Intl.DateTimeFormat("en-US", {
  month: "short",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

export type DevlogDateProps = { date: string; className?: string };

export function DevlogDate({ date, className }: DevlogDateProps) {
  return (
    <time
      dateTime={date}
      className={cn("font-mono text-[13px] text-faint", className)}
    >
      {format.format(new Date(`${date}T00:00:00Z`))}
    </time>
  );
}
