import { cn } from "@/lib/utils";

export type DiffLineView = {
  kind: "add" | "remove" | "context" | "hunk";
  text: string;
  number: number | null;
};

export type DiffViewProps = {
  path: string;
  note?: string;
  lines: DiffLineView[];
};

const SIGN = { add: "+", remove: "−", context: " ", hunk: "" } as const;

export function DiffView({ path, note, lines }: DiffViewProps) {
  return (
    <figure
      aria-label={`Changes to ${path}`}
      className="overflow-hidden rounded-md border border-border bg-card"
    >
      <figcaption className="flex gap-2 border-b border-border px-3 py-2 text-xs">
        <span className="min-w-0 truncate font-mono">{path}</span>
        {note && <span className="text-faint">{note}</span>}
      </figcaption>
      <div className="overflow-x-auto py-1.5 font-mono text-xs leading-[1.7]">
        {lines.map((line, index) => (
          <div
            key={index}
            className={cn(
              "flex whitespace-pre",
              line.kind === "add" && "bg-add",
              line.kind === "remove" && "bg-del",
              line.kind === "hunk" && "text-faint",
            )}
          >
            <span className="w-10 shrink-0 pr-2 text-right text-faint select-none">
              {line.number ?? ""}
            </span>
            <span className="w-4 shrink-0 text-faint select-none">
              {SIGN[line.kind]}
            </span>
            <span className="pr-3">{line.text}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}
