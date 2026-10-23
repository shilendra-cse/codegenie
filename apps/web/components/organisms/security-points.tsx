import { Box, Check, GitBranch, ShieldCheck } from "lucide-react";
import { SecurityPoint } from "@/components/molecules/security-point";

export function SecurityPoints() {
  return (
    <section id="trust" className="border-t border-border">
      <div className="mx-auto flex max-w-[1160px] flex-wrap gap-12 px-6 py-[88px]">
        <div className="flex flex-[1_1_320px] flex-col gap-3">
          <span className="text-[13px] font-medium text-faint">Security</span>
          <h2 className="text-4xl leading-tight font-semibold tracking-[-0.025em]">
            Built to be trusted with your code
          </h2>
          <p className="text-base text-muted-foreground">
            You stay in control of what gets merged. CodeGenie only ever
            proposes changes.
          </p>
        </div>
        <div className="flex flex-[2_1_520px] flex-wrap gap-x-8 gap-y-7">
          <SecurityPoint icon={Box} title="Runs in a sandbox">
            Your code runs in an isolated, short-lived sandbox, never on our
            servers.
          </SecurityPoint>
          <SecurityPoint
            icon={GitBranch}
            title="Never touches your main branch"
          >
            Every change arrives on its own branch, as a pull request you
            review.
          </SecurityPoint>
          <SecurityPoint
            icon={ShieldCheck}
            title="Access you choose, per repository"
          >
            Short-lived tokens scoped to one repository. The agent itself never
            holds a token that can write.
          </SecurityPoint>
          <SecurityPoint icon={Check} title="Checks that really ran">
            Lint, type-check and tests run before and after the change, and the
            results go into the pull request.
          </SecurityPoint>
        </div>
      </div>
    </section>
  );
}
