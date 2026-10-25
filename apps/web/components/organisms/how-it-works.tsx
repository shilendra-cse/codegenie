import { PRODUCT_NAME } from "@hobai/shared/brand";
import { StepCard } from "@/components/molecules/step-card";

export function HowItWorks() {
  return (
    <section id="how" className="border-t border-border bg-surface">
      <div className="mx-auto flex max-w-[1160px] flex-col gap-10 px-6 py-24">
        <div className="reveal flex max-w-[640px] flex-col gap-2.5">
          <span className="text-[13px] font-medium text-faint">
            How it works
          </span>
          <h2 className="text-[40px] leading-[1.1] font-semibold tracking-[-0.03em]">
            From a sentence to a pull request
          </h2>
        </div>
        <div className="reveal flex flex-wrap gap-4">
          <StepCard number="01" title="Connect a repository">
            Install the GitHub App on the repositories you choose. {PRODUCT_NAME}
            learns how to install and check each one, and asks you only what it
            can&apos;t work out.
          </StepCard>
          <StepCard number="02" title="Describe the task">
            Say what should change. Watch it work live: every file it reads,
            every edit and every command, with the reasoning behind them.
          </StepCard>
          <StepCard number="03" title="Review the pull request">
            A pull request with a summary and your checks&apos; results. Ready
            when checks pass, a draft when they don&apos;t, so nothing
            unfinished looks finished.
          </StepCard>
        </div>
      </div>
    </section>
  );
}
