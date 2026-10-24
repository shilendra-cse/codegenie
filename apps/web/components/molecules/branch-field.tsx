"use client";

import { GitBranch } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Input } from "@/components/atoms/input";

export type BranchFieldProps = {
  value: string;
  onChange: (branch: string) => void;
  error: string | null;
};

export function BranchField({ value, onChange, error }: BranchFieldProps) {
  const [editing, setEditing] = useState(false);
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
          onClick={() => setEditing(true)}
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
          className="h-[30px] w-[180px] font-mono text-xs"
        />
      </span>
      {error && (
        <span role="alert" className="text-xs text-err">
          {error}
        </span>
      )}
    </span>
  );
}
