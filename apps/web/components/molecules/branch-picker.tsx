"use client";

import { Check, ChevronDown, GitBranch } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/atoms/command";
import { Icon } from "@/components/atoms/icon";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/atoms/popover";
import { Skeleton } from "@/components/atoms/skeleton";
import { cn } from "@/lib/utils";

export type BranchPickerProps = {
  value: string;
  defaultBranch: string;
  /** Undefined until loaded. */
  branches: string[] | undefined;
  truncated: boolean;
  loading: boolean;
  error: string | null;
  /** Called when the list opens, so the branches are asked for only when wanted. */
  onOpen: () => void;
  onRetry: () => void;
  onChange: (branch: string) => void;
};

export function BranchPicker(props: BranchPickerProps) {
  const [open, setOpen] = useState(false);
  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) props.onOpen();
      }}
    >
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          aria-label={`Base branch: ${props.value}`}
          className="text-muted-foreground"
        >
          <Icon icon={GitBranch} size={14} />
          <span className="max-w-[180px] truncate font-mono text-xs">
            {props.value}
          </span>
          <Icon icon={ChevronDown} size={14} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[300px] overflow-hidden">
        <Command label="Branches">
          <CommandInput placeholder="Search branches" />
          <CommandList>
            <BranchList
              {...props}
              onPick={(branch) => {
                props.onChange(branch);
                setOpen(false);
              }}
            />
          </CommandList>
          <div className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border px-3 py-1.5 text-[11.5px] text-faint">
            {props.truncated ? (
              <span>Only the first 1,000 branches are listed.</span>
            ) : (
              <>
                <span>
                  <span className="font-mono">↑↓</span> to move
                </span>
                <span>
                  <span className="font-mono">↵</span> to pick
                </span>
                <span>
                  <span className="font-mono">esc</span> to close
                </span>
              </>
            )}
          </div>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function BranchList({
  value,
  defaultBranch,
  branches,
  loading,
  error,
  onRetry,
  onPick,
}: BranchPickerProps & { onPick: (branch: string) => void }) {
  if (error) {
    return (
      <div className="flex flex-col items-start gap-2 px-2.5 py-2 text-[13px]">
        <span className="text-muted-foreground">{error}</span>
        <Button size="sm" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  }
  if (loading || !branches) {
    return (
      <div
        aria-busy
        aria-label="Loading branches"
        className="flex flex-col gap-2.5 px-2.5 py-2"
      >
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-4/5" />
        <Skeleton className="h-3 w-2/5" />
      </div>
    );
  }
  return (
    <>
      <CommandEmpty className="px-2.5 py-2 text-[13px] text-faint">
        No branches match.
      </CommandEmpty>
      {branches.map((branch) => (
        <CommandItem
          key={branch}
          value={branch}
          onSelect={() => onPick(branch)}
        >
          <Icon
            icon={Check}
            size={14}
            className={cn("text-foreground", branch !== value && "invisible")}
          />
          <span className="min-w-0 flex-1 truncate font-mono text-[12.5px]">
            {branch}
          </span>
          {branch === defaultBranch && (
            <Badge className="h-5 text-[11px]">default</Badge>
          )}
        </CommandItem>
      ))}
    </>
  );
}
