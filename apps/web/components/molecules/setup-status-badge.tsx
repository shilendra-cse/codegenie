import type { OnboardingState } from "@hobai/shared";
import { Check } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Icon } from "@/components/atoms/icon";
import { Spinner } from "@/components/atoms/spinner";

export type SetupStatusBadgeProps = {
  status: OnboardingState;
  version: number | null;
};

export function SetupStatusBadge({ status, version }: SetupStatusBadgeProps) {
  switch (status) {
    case "queued":
      return <Badge>Queued</Badge>;
    case "running":
      return (
        <Badge tone="progress" className="sheen">
          <Spinner size={12} />
          Setting up
        </Badge>
      );
    case "waiting":
      return (
        <Badge tone="progress">
          <span aria-hidden className="size-1.5 rounded-full bg-primary" />
          Waiting for your answer
        </Badge>
      );
    case "succeeded":
      return (
        <Badge tone="ok">
          <Icon icon={Check} size={14} />
          {version ? `Saved as v${version}` : "Saved"}
        </Badge>
      );
    case "failed":
      return <Badge tone="err">Failed</Badge>;
    case "cancelled":
      return <Badge>Stopped</Badge>;
  }
}
