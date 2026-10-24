import type { EnvironmentResponse } from "@codegenie/shared";
import { Check } from "lucide-react";
import type { ReactNode } from "react";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";

export type EnvironmentCardProps = {
  projectName: string;
  environment: EnvironmentResponse;
};

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <>
      <div className="px-[18px] pt-3.5 pb-1 text-xs font-medium text-faint">
        {title}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <tbody>{children}</tbody>
        </table>
      </div>
    </>
  );
}

function Row({
  name,
  cwd,
  command,
}: {
  name: string;
  cwd: string;
  command: string;
}) {
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="w-7 py-2 pl-[18px]">
        <Icon icon={Check} className="text-ok" />
      </td>
      <td className="px-3 py-2">{name}</td>
      <td className="px-3 py-2 font-mono text-faint">{cwd}</td>
      <td className="py-2 pr-[18px] pl-3 font-mono">{command}</td>
    </tr>
  );
}

export function EnvironmentCard({
  projectName,
  environment,
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
      <Section title="Setup steps">
        {environment.steps.map((step) => (
          <Row key={`${step.cwd}:${step.name}`} {...step} />
        ))}
      </Section>
      <Section title="Checks, run before and after every task">
        {environment.checks.map((check) => (
          <Row key={`${check.cwd}:${check.name}`} {...check} />
        ))}
      </Section>
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
        <span className="ml-auto inline-flex items-center gap-2.5">
          <span className="text-[13px] text-faint">Coming soon</span>
          <Button
            disabled
            title="Coming soon"
            className="disabled:text-faint disabled:opacity-100"
          >
            Describe your first task
          </Button>
        </span>
      </div>
    </section>
  );
}
