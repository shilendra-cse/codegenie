import { cn } from "@/lib/utils";

export type GridBackdropProps = { focus?: "top" | "center" };

export function GridBackdrop({ focus = "top" }: GridBackdropProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid-backdrop pointer-events-none absolute inset-0 -z-20",
        focus === "center" && "grid-backdrop-center",
      )}
    />
  );
}
