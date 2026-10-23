import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Icon } from "@/components/atoms/icon";

export type SecurityPointProps = {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
};

export function SecurityPoint({ icon, title, children }: SecurityPointProps) {
  return (
    <div className="flex min-w-[240px] flex-1 flex-col gap-2">
      <Icon icon={icon} size={20} />
      <h3 className="text-[15px] font-semibold">{title}</h3>
      <p className="text-muted-foreground">{children}</p>
    </div>
  );
}
