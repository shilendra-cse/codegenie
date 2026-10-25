import type { EnvironmentResponse } from "@codegenie/shared";
import { Check } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { CommandTable } from "@/components/molecules/command-table";

export type EnvironmentCardProps = {
  projectName: string;
  environment: EnvironmentResponse;
  newTaskHref: string;
};

export function EnvironmentCard({
  projectName,
  environment,
  newTaskHref,
}: EnvironmentCardProps) {
  const headingId = `environment-v${environment.version}`;
  return (
    <section
      aria-labelledby={headingId}
      className="rise overflow-hidden rounded-lg border border-border bg-card"
    >
      <div className="flex flex-wrap items-center gap-2.5 border-b border-border px-[18px] py-4">
        <h2 id={headingId} className="text-base font-semibold">
          {projectName}&apos;s environment
        </h2>
        <Badge tone="ok">
          v{environment.version}
          {environment.active && " · active"}
        </Badge>
      </div>
      <CommandTable title="Setup steps" commands={environment.steps} ticked />
      <CommandTable
        title="Checks, run before and after every task"
        commands={environment.checks}
        ticked
      />
      {environment.decisions.length > 0 && (
        <div className="flex flex-col gap-1.5 border-t border-border px-[18px] py-3.5">
          <span className="text-xs font-medium text-faint">Decisions</span>
          {environment.decisions.map((decision) => (
            <span key={decision.question} className="text-[13px]">
              <span className="text-muted-foreground">
                {decision.question} →
              </span>{" "}
              {decision.answer}{" "}
              <span className="text-faint">
                ({decision.auto ? "detected" : "you"})
              </span>
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2.5 border-t border-border bg-surface px-[18px] py-3.5">
        <span className="inline-flex items-center gap-1.5 font-medium text-ok">
          <Icon icon={Check} />
          Saved. {projectName} is ready.
        </span>
        <Button asChild variant="primary" glow className="ml-auto">
          <Link href={newTaskHref}>Describe your first task</Link>
        </Button>
      </div>
    </section>
  );
}
