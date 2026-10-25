import type { EnvironmentResponse } from "@codegenie/shared";
import type { ReactNode } from "react";
import { Alert } from "@/components/atoms/alert";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { CommandTable } from "@/components/molecules/command-table";

export type EnvironmentSummaryProps = {
  environment: EnvironmentResponse;
  savedAgo: string;
  onRerun: () => void;
  rerunning: boolean;
  rerunError: string | null;
  notice?: ReactNode;
};

export function EnvironmentSummary({
  environment,
  savedAgo,
  onRerun,
  rerunning,
  rerunError,
  notice,
}: EnvironmentSummaryProps) {
  const healthy = environment.health === "ok";
  return (
    <section aria-labelledby="environment" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id="environment" className="text-base font-semibold">
          Environment
        </h2>
        <Badge tone={healthy ? "ok" : "warn"}>
          v{environment.version} · active
        </Badge>
        <span className="text-[13px] text-faint">
          {healthy ? "" : "Needs attention · "}Saved {savedAgo}
        </span>
        <span className="flex-1" />
        <Button size="sm" busy={rerunning} onClick={onRerun}>
          Re-run setup
        </Button>
      </div>
      {rerunError && <Alert tone="error">{rerunError}</Alert>}
      {notice}
      <div className="rise overflow-hidden rounded-lg border border-border bg-card">
        <CommandTable title="Setup steps" commands={environment.steps} />
        <CommandTable title="Checks" commands={environment.checks} />
      </div>
    </section>
  );
}
