"use client";

import { Check, GitBranch, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Input } from "@/components/atoms/input";
import { Tooltip } from "@/components/atoms/tooltip";

export type BranchFieldProps = {
  value: string;
  onChange: (branch: string) => void;
  error: string | null;
};

export function BranchField({ value, onChange, error }: BranchFieldProps) {
  // The branch before editing, so Esc can put it back; null while not editing.
  const [before, setBefore] = useState<string | null>(null);
  const editing = before !== null;
  const apply = () => {
    if (!error) setBefore(null);
  };
  const cancel = () => {
    onChange(before ?? value);
    setBefore(null);
  };
  if (!editing) {
    return (
      <span className="inline-flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
        <Icon icon={GitBranch} size={14} />
        <span className="font-mono" aria-label="Base branch">
          {value}
        </span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-1.5 text-xs"
          onClick={() => setBefore(value)}
        >
          Change
        </Button>
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex items-center gap-1.5 text-muted-foreground">
        <Icon icon={GitBranch} size={14} />
        <Input
          aria-label="Base branch"
          aria-invalid={Boolean(error)}
          autoFocus
          spellCheck={false}
          value={value}
          maxLength={255}
          onChange={(event) => onChange(event.target.value)}
          onBlur={apply}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              // Enter applies the branch; it doesn't start the task.
              event.preventDefault();
              apply();
            } else if (event.key === "Escape") {
              cancel();
            }
          }}
          className="h-[30px] w-[180px] font-mono text-xs"
        />
        <EditButton
          label="Apply"
          shortcut="Enter"
          icon={Check}
          onClick={apply}
          disabled={Boolean(error)}
        />
        <EditButton label="Cancel" shortcut="Esc" icon={X} onClick={cancel} />
      </span>
      {error && (
        <span role="alert" className="text-xs text-err">
          {error}
        </span>
      )}
    </span>
  );
}

function EditButton({
  label,
  shortcut,
  icon,
  onClick,
  disabled = false,
}: {
  label: string;
  shortcut: string;
  icon: typeof Check;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <Tooltip content={`${label} (${shortcut})`}>
      <Button
        variant="ghost"
        size="sm"
        aria-label={label}
        disabled={disabled}
        className="size-[30px] px-0"
        // Keeps focus in the field, so clicking away doesn't apply before Cancel runs.
        onMouseDown={(event) => event.preventDefault()}
        onClick={onClick}
      >
        <Icon icon={icon} size={14} />
      </Button>
    </Tooltip>
  );
}
