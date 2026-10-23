import {
  AvatarFallback,
  AvatarImage,
  Avatar as FactoryAvatar,
} from "@/components/factory/avatar";
import { cn } from "@/lib/utils";

export type AvatarProps = {
  name: string;
  src?: string | null;
  size?: 24 | 32;
  className?: string;
};

export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function Avatar({ name, src, size = 24, className }: AvatarProps) {
  return (
    <FactoryAvatar className={cn(size === 24 ? "size-6" : "size-8", className)}>
      {src && <AvatarImage src={src} alt={name} />}
      <AvatarFallback className="bg-primary-soft text-[11px] font-semibold text-primary-text">
        {initials(name)}
      </AvatarFallback>
    </FactoryAvatar>
  );
}
