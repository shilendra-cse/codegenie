import Image from "next/image";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { cn } from "@/lib/utils";

const FULL = {
  light: "/brand/black/hobai-black.png",
  dark: "/brand/white/hobai-white.png",
};
const MARK = {
  light: "/brand/black/hobai_icon_black.png",
  dark: "/brand/white/hobai_icon_white.png",
};

export type LogoProps = {
  variant?: "full" | "mark";
  /** The mark's width in px; the image is requested at this size, so it stays sharp. */
  size?: 24 | 40;
  className?: string;
};

export function Logo({ variant = "full", size = 24, className }: LogoProps) {
  if (variant === "mark") {
    const height = (size * 3) / 4;
    return (
      <span
        role="img"
        aria-label={PRODUCT_NAME}
        className={cn("inline-flex shrink-0", className)}
        style={{ width: size, height }}
      >
        <Image
          src={MARK.light}
          alt=""
          width={size}
          height={height}
          className="size-full object-contain dark:hidden"
        />
        <Image
          src={MARK.dark}
          alt=""
          width={size}
          height={height}
          className="hidden size-full object-contain dark:block"
        />
      </span>
    );
  }
  return (
    <span
      role="img"
      aria-label={PRODUCT_NAME}
      className={cn("block h-[25px] w-24 shrink-0", className)}
    >
      <Image
        src={FULL.light}
        alt=""
        width={96}
        height={25}
        className="size-full dark:hidden"
      />
      <Image
        src={FULL.dark}
        alt=""
        width={96}
        height={25}
        className="hidden size-full dark:block"
      />
    </span>
  );
}
