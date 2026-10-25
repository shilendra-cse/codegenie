import { TriangleAlert } from "lucide-react";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";

export type NeedsAttentionBannerProps = {
  reasons: string[];
  onRerun: () => void;
  rerunning: boolean;
  error: string | null;
};

export function NeedsAttentionBanner({
  reasons,
  onRerun,
  rerunning,
  error,
}: NeedsAttentionBannerProps) {
  return (
    <div
      role="status"
      className="mx-6 mt-4 flex flex-wrap items-center gap-2.5 rounded-[10px] border border-warn-border bg-warn-soft px-3.5 py-3"
    >
      <Icon icon={TriangleAlert} className="text-warn" />
      <span className="flex-[1_1_320px]">
        <strong className="font-semibold">Setup needs attention.</strong>{" "}
        {reasons.join(" ")} Tasks may fail until setup is re-run.
        {error && <span className="block text-err">{error}</span>}
      </span>
      <Button size="sm" busy={rerunning} onClick={onRerun}>
        Re-run setup
      </Button>
    </div>
  );
}
