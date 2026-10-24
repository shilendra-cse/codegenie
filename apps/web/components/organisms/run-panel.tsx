"use client";

import { FileText } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Skeleton } from "@/components/atoms/skeleton";
import {
  ChecksTable,
  type CheckRowView,
} from "@/components/molecules/checks-table";
import { type DiffLineView, DiffView } from "@/components/molecules/diff-view";
import {
  TerminalBlock,
  type TerminalBlockProps,
} from "@/components/molecules/terminal-block";

export type PanelTab = "changes" | "terminal" | "checks";

export type PanelFile = {
  path: string;
  added: number | null;
  removed: number | null;
};

export type PanelChanges =
  /** While running: the files the agent changed, counted from its edits. */
  | { status: "live"; files: PanelFile[] }
  | { status: "loading" }
  | { status: "error"; onRetry: () => void }
  | {
      status: "ended";
      files: PanelFile[];
      /** The picked file's lines. */
      lines: DiffLineView[] | null;
      truncated: boolean;
    };

export type RunPanelProps = {
  tab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  changes: PanelChanges;
  selectedFile: string | null;
  onSelectFile: (path: string) => void;
  commands: (TerminalBlockProps & { id: string })[];
  selectedCommand: string | null;
  checks: CheckRowView[];
  /** pending until the checks run again; missing for a run that ended without recording them. */
  checksAfter: "pending" | "done" | "missing";
};

const TABS: { id: PanelTab; label: string }[] = [
  { id: "changes", label: "Changes" },
  { id: "terminal", label: "Terminal" },
  { id: "checks", label: "Checks" },
];

const empty = (text: string) => (
  <p className="px-1 py-2 text-[13px] text-faint">{text}</p>
);

function Files({
  files,
  selected,
  onSelect,
}: {
  files: PanelFile[];
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  return (
    <ul className="flex flex-col gap-0.5">
      {files.map((file) => (
        <li key={file.path}>
          <button
            type="button"
            aria-current={file.path === selected || undefined}
            onClick={() => onSelect(file.path)}
            className="flex w-full items-center gap-2 rounded-sm px-2.5 py-1.5 text-left text-[13px] hover:bg-muted focus-visible:outline-2 focus-visible:outline-primary aria-[current=true]:bg-muted"
          >
            <Icon icon={FileText} size={14} className="text-faint" />
            <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
              {file.path}
            </span>
            {file.added !== null && file.added > 0 && (
              <span className="font-mono text-xs text-ok">+{file.added}</span>
            )}
            {file.removed !== null && file.removed > 0 && (
              <span className="font-mono text-xs text-err">
                −{file.removed}
              </span>
            )}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Changes({
  changes,
  selected,
  onSelect,
}: {
  changes: PanelChanges;
  selected: string | null;
  onSelect: (path: string) => void;
}) {
  switch (changes.status) {
    case "loading":
      return (
        <div
          aria-busy
          aria-label="Loading the changes"
          className="flex flex-col gap-2"
        >
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
          <Skeleton className="h-40 w-full rounded-md" />
        </div>
      );
    case "error":
      return (
        <div className="flex flex-col items-start gap-2 text-[13px]">
          <span className="text-muted-foreground">
            Couldn&apos;t load the changes.
          </span>
          <Button size="sm" onClick={changes.onRetry}>
            Try again
          </Button>
        </div>
      );
    case "live":
      return changes.files.length === 0 ? (
        empty("No changes yet.")
      ) : (
        <>
          <Files
            files={changes.files}
            selected={selected}
            onSelect={onSelect}
          />
          <p className="rounded-md border border-border bg-card px-3.5 py-3 text-[13px] text-muted-foreground">
            The full diff appears when the run finishes. Until then, these are
            the files the agent has changed, counted from its edits.
          </p>
        </>
      );
    case "ended": {
      if (changes.files.length === 0) return empty("No files were changed.");
      const path = selected ?? changes.files[0]!.path;
      return (
        <>
          <Files files={changes.files} selected={path} onSelect={onSelect} />
          {changes.lines && <DiffView path={path} lines={changes.lines} />}
          {changes.truncated &&
            empty("The diff was too big to keep in full; this is its start.")}
        </>
      );
    }
  }
}

function Terminal({
  commands,
  selected,
}: {
  commands: RunPanelProps["commands"];
  selected: string | null;
}) {
  const picked = useRef<HTMLDivElement>(null);
  useEffect(() => {
    picked.current?.scrollIntoView({ block: "nearest" });
  }, [selected]);
  if (commands.length === 0) return empty("No commands yet.");
  return (
    <>
      {commands.map(({ id, ...command }) => (
        <div key={id} ref={id === selected ? picked : undefined}>
          <TerminalBlock {...command} selected={id === selected} />
        </div>
      ))}
      <p className="text-xs text-faint">
        Each command shows up to 2,000 characters of its output.
      </p>
    </>
  );
}

function Checks({
  checks,
  after,
}: {
  checks: CheckRowView[];
  after: RunPanelProps["checksAfter"];
}) {
  if (checks.length === 0) return empty("No checks yet.");
  return (
    <>
      <ChecksTable
        checks={checks}
        afterFallback={after === "pending" ? "pending" : "—"}
      />
      <p className="text-xs text-faint">
        {after === "missing"
          ? "This run didn't record each check after the agent's work."
          : "“Before” ran right after setup. “After” runs once the agent finishes."}
      </p>
    </>
  );
}

export function RunPanel(props: RunPanelProps) {
  const fileCount =
    props.changes.status === "live" || props.changes.status === "ended"
      ? props.changes.files.length
      : null;
  return (
    <aside
      aria-label="Details"
      className="flex min-h-0 min-w-0 flex-[1_1_440px] flex-col border-t border-border bg-surface min-[1200px]:border-t-0 min-[1200px]:border-l"
    >
      <div
        role="tablist"
        className="flex gap-0.5 border-b border-border px-2.5 pt-2"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={props.tab === tab.id}
            onClick={() => props.onTabChange(tab.id)}
            className="-mb-px inline-flex items-center gap-1.5 border-b-2 border-transparent px-2.5 py-2 text-[13px] font-medium text-muted-foreground hover:text-foreground focus-visible:outline-2 focus-visible:outline-primary aria-selected:border-foreground aria-selected:text-foreground"
          >
            {tab.label}
            {tab.id === "changes" && fileCount !== null && fileCount > 0 && (
              <span className="text-xs text-faint">{fileCount}</span>
            )}
          </button>
        ))}
      </div>
      <div
        role="tabpanel"
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-3 *:shrink-0"
      >
        {props.tab === "changes" && (
          <Changes
            changes={props.changes}
            selected={props.selectedFile}
            onSelect={props.onSelectFile}
          />
        )}
        {props.tab === "terminal" && (
          <Terminal
            commands={props.commands}
            selected={props.selectedCommand}
          />
        )}
        {props.tab === "checks" && (
          <Checks checks={props.checks} after={props.checksAfter} />
        )}
      </div>
    </aside>
  );
}
