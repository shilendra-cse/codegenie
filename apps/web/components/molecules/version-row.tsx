import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";

export type VersionRowProps = {
  version: number;
  active: boolean;
  activeVersion: number;
  made: string;
  when: string;
  confirming: boolean;
  restoring: boolean;
  error: string | null;
  onRestore: () => void;
  onConfirm: () => void;
  onCancel: () => void;
};

export function VersionRow({
  version,
  active,
  activeVersion,
  made,
  when,
  confirming,
  restoring,
  error,
  onRestore,
  onConfirm,
  onCancel,
}: VersionRowProps) {
  return (
    <div className="border-b border-border last:border-b-0">
      <div className="flex flex-wrap items-center gap-2.5 px-4 py-3">
        <span className="font-mono font-medium">v{version}</span>
        {active ? <Badge tone="ok">active</Badge> : <Badge>replaced</Badge>}
        <span className="flex-[1_1_260px] text-muted-foreground">
          {made} <span className="text-faint">· {when}</span>
        </span>
        {!active && !confirming && (
          <Button size="sm" variant="ghost" onClick={onRestore}>
            Restore
          </Button>
        )}
      </div>
      {confirming && (
        <div
          role="group"
          aria-label={`Restore v${version}`}
          className="flex flex-wrap items-center gap-2.5 border-t border-border bg-surface px-4 py-3"
        >
          <span className="flex-[1_1_280px]">
            Make v{version} active again? New tasks will use its steps and
            checks. v{activeVersion} is kept.
          </span>
          <Button size="sm" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            busy={restoring}
            onClick={onConfirm}
          >
            Restore v{version}
          </Button>
        </div>
      )}
      {error && (
        <div
          role="alert"
          className="border-t border-border px-4 py-2.5 text-[13px] text-err"
        >
          {error}
        </div>
      )}
    </div>
  );
}
