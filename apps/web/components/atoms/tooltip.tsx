import type { ReactElement } from "react";
import {
  Tooltip as FactoryTooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/factory/tooltip";

export type TooltipProps = {
  /** A short note; tooltips hold a line, not a paragraph. */
  content: string;
  /** One element that can take focus, so keyboard users get the tip too. */
  children: ReactElement;
};

export function Tooltip({ content, children }: TooltipProps) {
  return (
    <FactoryTooltip delayDuration={200}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        sideOffset={6}
        // Themed like our menus rather than inverted. No arrow, as on menus; Radix styles it inline, hence !important.
        className="max-w-[240px] border border-border bg-card px-2.5 py-1.5 text-[12.5px] leading-snug text-foreground shadow-card [&_svg]:hidden!"
      >
        {content}
      </TooltipContent>
    </FactoryTooltip>
  );
}
