"use client";

import { ArrowUp } from "lucide-react";
import Link from "next/link";
import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import {
  BranchPicker,
  type BranchPickerProps,
} from "@/components/molecules/branch-picker";
import {
  type PickerProject,
  ProjectPicker,
} from "@/components/molecules/project-picker";
import {
  type RunLimit,
  RunLimitBanner,
} from "@/components/molecules/run-limit-banner";
import { formatDay } from "@/lib/format";

export type TaskComposerProps = {
  text: string;
  onTextChange: (text: string) => void;
  projects: PickerProject[];
  projectId: string | null;
  onProjectChange: (id: string) => void;
  branch: BranchPickerProps;
  canStart: boolean;
  starting: boolean;
  error: {
    message: string;
    fix: { label: string; href: string } | null;
  } | null;
  /** Set once the cycle's runs are used: nothing can start until they reset. */
  runLimit: RunLimit | null;
  onStart: () => void;
};

export function TaskComposer({
  text,
  onTextChange,
  projects,
  projectId,
  onProjectChange,
  branch,
  canStart,
  starting,
  error,
  runLimit,
  onStart,
}: TaskComposerProps) {
  const start = () => {
    if (canStart && !starting && !runLimit) onStart();
  };
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        start();
      }}
    >
      {runLimit && <RunLimitBanner {...runLimit} />}
      <div className="rounded-[14px] border border-border-strong bg-card shadow-card focus-within:outline-2 focus-within:outline-offset-1 focus-within:outline-primary">
        <textarea
          aria-label="Task description"
          rows={4}
          maxLength={20_000}
          placeholder={
            runLimit
              ? `New tasks can start again on ${formatDay(runLimit.resetsAt)}.`
              : "Describe the change: what should happen, where, and how you'd check it works."
          }
          disabled={Boolean(runLimit)}
          value={text}
          onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              start();
            }
          }}
          className="block min-h-[120px] w-full resize-none bg-transparent px-4 pt-4 pb-2 text-[15px] leading-[1.55] outline-none placeholder:text-faint disabled:cursor-not-allowed"
        />
        <div className="flex flex-wrap items-center gap-2 px-2.5 pt-2 pb-2.5">
          <ProjectPicker
            projects={projects}
            selectedId={projectId}
            onSelect={onProjectChange}
          />
          {projectId && <BranchPicker {...branch} />}
          <span className="flex-1" />
          <kbd className="font-mono text-xs text-faint">⌘ ↵</kbd>
          <Button
            type="submit"
            variant="primary"
            size="sm"
            glow
            busy={starting}
            disabled={!canStart || Boolean(runLimit)}
          >
            <Icon icon={ArrowUp} />
            Start
          </Button>
        </div>
      </div>
      {error && (
        <Alert tone="error">
          {error.message}
          {error.fix && (
            <>
              {" "}
              <Link
                href={error.fix.href}
                className="font-medium underline underline-offset-2"
              >
                {error.fix.label}
              </Link>
            </>
          )}
        </Alert>
      )}
    </form>
  );
}
