import { Check, GitBranch, ShieldCheck } from "lucide-react";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { SecurityPoint } from "@/components/molecules/security-point";
import { SecurityDiagram } from "./security-diagram";

export function SecurityPoints() {
  return (
    <section id="trust" className="border-t border-border">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-12 px-6 py-24">
        <div className="reveal flex flex-wrap items-end gap-x-12 gap-y-6">
          <div className="flex flex-[1_1_420px] flex-col gap-3">
            <span className="text-[13px] font-medium text-faint">Security</span>
            <h2 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.03em]">
              Built to be trusted with your code
            </h2>
          </div>
          <p className="flex-[1_1_320px] text-base text-muted-foreground">
            You stay in control of what gets merged. {PRODUCT_NAME} only ever
            proposes changes, and the agent never holds a token that can write.
          </p>
        </div>
        <SecurityDiagram />
        <div className="reveal flex flex-wrap gap-x-8 gap-y-7">
          <SecurityPoint icon={GitBranch} title="Never your main branch">
            Every change arrives on its own branch, as a pull request.
          </SecurityPoint>
          <SecurityPoint icon={ShieldCheck} title="Access per repository">
            You choose which repositories the GitHub App can see.
          </SecurityPoint>
          <SecurityPoint icon={Check} title="Checks that really ran">
            Before and after the change; the results go into the pull request.
          </SecurityPoint>
        </div>
      </div>
    </section>
  );
}
