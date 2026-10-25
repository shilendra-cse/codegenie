import { PRODUCT_NAME } from "@hobai/shared/brand";
import { Logo } from "@/components/atoms/logo";

export type SetupIntroProps = { projectName: string };

export function SetupIntro({ projectName }: SetupIntroProps) {
  return (
    <div className="rise flex gap-3">
      <span className="flex size-7 shrink-0 items-center justify-center">
        <Logo variant="mark" />
      </span>
      <div className="flex flex-col gap-1 pt-0.5">
        <span className="font-semibold">{PRODUCT_NAME}</span>
        <p>
          I&apos;ll get <strong>{projectName}</strong> ready: install it, find
          its checks and run them, so every task starts from a setup that&apos;s
          known to work. This happens once and takes a few minutes. If I
          can&apos;t decide something, I&apos;ll ask you here.
        </p>
      </div>
    </div>
  );
}
