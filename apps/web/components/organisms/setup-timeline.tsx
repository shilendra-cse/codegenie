"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Icon } from "@/components/atoms/icon";
import {
  type LineState,
  TimelineLine,
} from "@/components/molecules/timeline-line";
import { cn } from "@/lib/utils";

type Check = { name: string; cwd: string; status?: string };

export type SetupLineView = {
  key: string;
  state: LineState;
  durationMs: number | null;
} & (
  | { kind: "text"; text: string }
  | { kind: "problems"; items: string[] }
  | {
      kind: "projects";
      projects: { cwd: string; packageManager: string | null }[];
    }
  | {
      kind: "tried";
      phase: "first" | "agent" | "final";
      installCommand: string | null;
      installed: boolean;
      checks: Check[];
    }
  | {
      kind: "agent";
      actions: { id: string; tool: string; target: string | null }[];
    }
);

const VERBS: Record<string, string> = {
  read_file: "Read",
  bash: "Ran",
  search: "Searched for",
  list_files: "Listed",
};

const plural = (count: number, word: string) =>
  `${count} ${word}${count === 1 ? "" : "s"}`;

function checksSummary(checks: Check[]) {
  const passing = checks.filter((c) => c.status === "passing").length;
  return `${passing} of ${plural(checks.length, "check")} passing`;
}

function TriedLine({
  line,
}: {
  line: Extract<SetupLineView, { kind: "tried" }>;
}) {
  const all = line.checks.every((c) => c.status === "passing");
  const title =
    line.phase === "final"
      ? "Final check in a fresh sandbox"
      : line.phase === "agent"
        ? "Tried a new setup"
        : null;
  return (
    <>
      <span>
        {title ?? (
          <>
            {line.installed ? "Installed" : "Couldn't install"}
            {line.installCommand && (
              <>
                {" with "}
                <span className="font-mono text-[13px]">
                  {line.installCommand}
                </span>
              </>
            )}
          </>
        )}
        {line.checks.length > 0 && ` · ${checksSummary(line.checks)}`}
      </span>
      {/* Every check on the first try; afterwards only when something still fails. */}
      {line.checks.length > 0 && (line.phase === "first" || !all) && (
        <div className="flex flex-wrap gap-1.5">
          {line.checks.map((check) => (
            <Badge
              key={`${check.cwd}:${check.name}`}
              tone={check.status === "passing" ? "ok" : "err"}
            >
              {check.cwd === "." ? check.name : `${check.cwd} ${check.name}`}
            </Badge>
          ))}
        </div>
      )}
    </>
  );
}

function AgentLine({
  line,
}: {
  line: Extract<SetupLineView, { kind: "agent" }>;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 self-start rounded-sm focus-visible:outline-2 focus-visible:outline-primary"
      >
        Looked into it · {plural(line.actions.length, "step")}
        <Icon
          icon={open ? ChevronDown : ChevronRight}
          size={14}
          className="text-faint"
        />
      </button>
      {open && (
        <ul className="flex flex-col gap-1 text-[13px] text-muted-foreground">
          {line.actions.map((action) => (
            <li key={action.id}>
              {VERBS[action.tool] ?? action.tool}
              {action.target && (
                <>
                  {" "}
                  <span className="font-mono">{action.target}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

export type SetupTimelineProps = {
  lines: SetupLineView[];
  /** Setup is working on these right now: the card gets the beam. */
  live: boolean;
};

export function SetupTimeline({ lines, live }: SetupTimelineProps) {
  if (lines.length === 0) return null;
  return (
    <div className={cn("rise", live && "beam shadow-none")}>
      <div
        className={cn(
          "rounded-lg bg-card px-[18px] py-1.5",
          !live && "border border-border",
        )}
      >
        {lines.map((line) => (
          <TimelineLine
            key={line.key}
            state={line.state}
            durationMs={line.durationMs}
            className="rise"
          >
            {line.kind === "text" && <span>{line.text}</span>}
            {line.kind === "problems" && (
              <>
                <span>
                  Found {plural(line.items.length, "problem")} to look into
                </span>
                <ul className="flex flex-col gap-1 text-[13px] text-muted-foreground">
                  {line.items.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </>
            )}
            {line.kind === "projects" && (
              <>
                <span>Found {plural(line.projects.length, "project")}</span>
                <div className="flex flex-wrap gap-1.5">
                  {line.projects.map((project) => (
                    <span
                      key={project.cwd}
                      className="rounded-sm border border-border bg-code px-2 py-0.5 font-mono text-xs"
                    >
                      {project.cwd === "." ? "root" : project.cwd}
                      {project.packageManager && ` · ${project.packageManager}`}
                    </span>
                  ))}
                </div>
              </>
            )}
            {line.kind === "tried" && <TriedLine line={line} />}
            {line.kind === "agent" && <AgentLine line={line} />}
          </TimelineLine>
        ))}
      </div>
    </div>
  );
}
