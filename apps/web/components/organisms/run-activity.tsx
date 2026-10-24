"use client";

import {
  Check,
  ChevronDown,
  ChevronRight,
  CircleX,
  FilePen,
  FilePlus,
  ListChecks,
  Search,
  SquareTerminal,
  Wrench,
} from "lucide-react";
import { useState } from "react";
import { Icon } from "@/components/atoms/icon";
import { Spinner } from "@/components/atoms/spinner";
import { cn } from "@/lib/utils";

export type ActivityItemView = {
  id: string;
  tool: string;
  target: string | null;
};

export type ActivityView = {
  id: string;
  running: boolean;
  failed: boolean;
} & (
  | {
      kind: "explored";
      reads: number;
      searches: number;
      listings: number;
      items: ActivityItemView[];
    }
  | {
      kind: "edit";
      path: string;
      whole: boolean;
      added: number;
      removed: number;
    }
  | { kind: "command"; command: string; exitCode: number | null }
  | { kind: "checks"; passing: number; failing: number }
  | { kind: "tool"; tool: string; target: string | null }
);

const VERBS: Record<string, string> = {
  read_file: "Read",
  search: "Searched for",
  list_files: "Listed",
};

const plural = (count: number, word: string, many = `${word}s`) =>
  `${count} ${count === 1 ? word : many}`;

function exploredSummary(row: Extract<ActivityView, { kind: "explored" }>) {
  return [
    row.reads && `read ${plural(row.reads, "file")}`,
    row.searches && `searched ${plural(row.searches, "time")}`,
    row.listings && `listed ${plural(row.listings, "folder")}`,
  ]
    .filter(Boolean)
    .join(", ");
}

function Mark({ row, icon }: { row: ActivityView; icon: typeof Check }) {
  if (row.running) return <Spinner size={14} className="text-primary-text" />;
  return (
    <Icon
      icon={icon}
      size={14}
      className={row.failed ? "text-err" : "text-faint"}
    />
  );
}

function Explored({
  row,
}: {
  row: Extract<ActivityView, { kind: "explored" }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <li className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 self-start rounded-sm text-left focus-visible:outline-2 focus-visible:outline-primary"
      >
        <Mark row={row} icon={Search} />
        <span>
          Explored the code
          <span className="text-muted-foreground">
            {" · "}
            {exploredSummary(row)}
          </span>
        </span>
        <Icon
          icon={open ? ChevronDown : ChevronRight}
          size={14}
          className="text-faint"
        />
      </button>
      {open && (
        <ul className="ml-6 flex flex-col gap-0.5 text-[13px] text-muted-foreground">
          {row.items.map((item) => (
            <li key={item.id} className="min-w-0 truncate">
              {VERBS[item.tool] ?? item.tool}{" "}
              {item.target && (
                <span className="font-mono text-[12.5px]">{item.target}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

function Row({ row }: { row: Exclude<ActivityView, { kind: "explored" }> }) {
  switch (row.kind) {
    case "edit":
      return (
        <li className="flex min-w-0 items-center gap-2">
          <Mark row={row} icon={row.whole ? FilePlus : FilePen} />
          <span className="min-w-0 truncate">
            {row.failed ? "Couldn't edit" : row.whole ? "Wrote" : "Edited"}{" "}
            <span className="font-mono text-[12.5px]">{row.path}</span>
          </span>
          {!row.failed && !row.running && (
            <span className="font-mono text-xs">
              {row.added > 0 && <span className="text-ok">+{row.added}</span>}
              {row.removed > 0 && (
                <span className="ml-1 text-err">−{row.removed}</span>
              )}
            </span>
          )}
        </li>
      );
    case "command":
      return (
        <li className="flex min-w-0 items-center gap-2">
          <Mark row={row} icon={SquareTerminal} />
          <span className="min-w-0 truncate">
            {row.running ? "Running" : "Ran"}{" "}
            <span className="font-mono text-[12.5px]">{row.command}</span>
          </span>
          {row.exitCode !== null && (
            <span
              className={cn(
                "inline-flex shrink-0 items-center gap-1 text-xs",
                row.exitCode === 0 ? "text-ok" : "text-err",
              )}
            >
              <Icon icon={row.exitCode === 0 ? Check : CircleX} size={14} />
              {row.exitCode === 0 ? "ok" : `exit ${row.exitCode}`}
            </span>
          )}
        </li>
      );
    case "checks":
      return (
        <li className="flex items-center gap-2">
          <Mark row={row} icon={ListChecks} />
          <span>
            {row.running ? "Running the checks" : "Ran the checks"}
            {!row.running && row.passing + row.failing > 0 && (
              <span className="text-muted-foreground">
                {" · "}
                {row.passing} passing
                {row.failing > 0 && (
                  <span className="text-err">, {row.failing} failing</span>
                )}
              </span>
            )}
          </span>
        </li>
      );
    case "tool":
      return (
        <li className="flex min-w-0 items-center gap-2">
          <Mark row={row} icon={Wrench} />
          <span className="min-w-0 truncate">
            {row.tool}{" "}
            {row.target && (
              <span className="font-mono text-[12.5px]">{row.target}</span>
            )}
          </span>
        </li>
      );
  }
}

export type RunActivityProps = {
  activity: ActivityView[];
  /** What the agent is saying now, streamed. */
  reasoning: string;
  live: boolean;
};

export function RunActivity({ activity, reasoning, live }: RunActivityProps) {
  if (activity.length === 0 && !reasoning) return null;
  return (
    <div className="flex flex-col gap-2 text-[13.5px]">
      <ul className="flex flex-col gap-1.5">
        {activity.map((row) =>
          row.kind === "explored" ? (
            <Explored key={row.id} row={row} />
          ) : (
            <Row key={row.id} row={row} />
          ),
        )}
      </ul>
      {live && reasoning.trim() && (
        <p className="ml-6 text-[13px] text-faint italic">
          {reasoning.trim()}
          <span aria-hidden className="caret" />
        </p>
      )}
    </div>
  );
}
