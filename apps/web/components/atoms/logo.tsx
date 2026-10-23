import Image from "next/image";
import { cn } from "@/lib/utils";

const FULL = {
  light: "/brand/black/codegenie_logo_transparent.png",
  dark: "/brand/white/codegenie_logo_white_transparent.png",
};
const MARK = {
  light: "/brand/black/codegenie_icon_black.png",
  dark: "/brand/white/codegenie_icon_white.png",
};

export type LogoProps = {
  variant?: "full" | "mark";
  className?: string;
};

export function Logo({ variant = "full", className }: LogoProps) {
  if (variant === "mark") {
    return (
      <span
        role="img"
        aria-label="CodeGenie"
        className={cn("inline-flex h-[18px] w-6 shrink-0", className)}
      >
        <Image
          src={MARK.light}
          alt=""
          width={24}
          height={18}
          className="size-full object-contain dark:hidden"
        />
        <Image
          src={MARK.dark}
          alt=""
          width={24}
          height={18}
          className="hidden size-full object-contain dark:block"
        />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label="CodeGenie"
      className={cn(
        "block h-[18px] w-[116px] shrink-0 overflow-hidden",
        className,
      )}
    >
      <Image
        src={FULL.light}
        alt=""
        width={192}
        height={64}
        className="-mt-[22.5px] -ml-[38px] max-w-none dark:hidden"
      />
      <Image
        src={FULL.dark}
        alt=""
        width={192}
        height={64}
        className="-mt-[22.5px] -ml-[38px] hidden max-w-none dark:block"
      />
    </span>
  );
}
