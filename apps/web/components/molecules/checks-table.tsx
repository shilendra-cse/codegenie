import type { CheckComparison, CheckStatus } from "@codegenie/shared";
import { cn } from "@/lib/utils";

export type CheckRowView = {
  name: string;
  cwd: string;
  before: CheckStatus | null;
  after: CheckStatus | null;
  comparison: CheckComparison | null;
};

const STATUS: Record<CheckStatus, string> = {
  passing: "passing",
  failing: "failing",
  broken: "broken",
  "timed-out": "timed out",
};

const COMPARISON: Partial<
  Record<CheckComparison, { text: string; className: string }>
> = {
  fixed: { text: "fixed", className: "text-ok" },
  regressed: { text: "broken by this change", className: "text-err" },
  "still-failing": { text: "still failing", className: "text-err" },
};

function statusCell(status: CheckStatus | null, fallback: string) {
  return (
    <span
      className={cn(
        "w-[96px] shrink-0",
        status === "passing" ? "text-ok" : status ? "text-err" : "text-faint",
      )}
    >
      {status ? STATUS[status] : fallback}
    </span>
  );
}

export type ChecksTableProps = {
  checks: CheckRowView[];
  /** What an After cell without a result says, e.g. "pending" until the checks run again. */
  afterFallback: string;
};

/** Each check before and after the agent's work. */
export function ChecksTable({ checks, afterFallback }: ChecksTableProps) {
  return (
    <div className="overflow-hidden rounded-md border border-border bg-card text-[13px]">
      <div className="flex border-b border-border px-3 py-2 text-xs font-medium text-faint">
        <span className="flex-1">Check</span>
        <span className="w-[96px]">Before</span>
        <span className="w-[96px]">After</span>
      </div>
      {checks.map((check) => {
        const note = check.comparison && COMPARISON[check.comparison];
        return (
          <div
            key={`${check.cwd}:${check.name}`}
            className="flex items-center border-b border-border px-3 py-2.5 last:border-b-0"
          >
            <span className="min-w-0 flex-1">
              {check.name}{" "}
              {check.cwd !== "." && (
                <span className="font-mono text-xs text-faint">
                  {check.cwd}
                </span>
              )}
              {note && (
                <span className={cn("block text-xs", note.className)}>
                  {note.text}
                </span>
              )}
            </span>
            {statusCell(check.before, "—")}
            {statusCell(check.after, afterFallback)}
          </div>
        );
      })}
    </div>
  );
}
