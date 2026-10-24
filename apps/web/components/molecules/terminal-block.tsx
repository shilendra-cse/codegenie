import { cn } from "@/lib/utils";

export type TerminalBlockProps = {
  command: string;
  output: string | null;
  exitCode: number | null;
  running: boolean;
  cutShort: boolean;
  selected?: boolean;
};

/** One command and what it printed; always dark, like a terminal. */
export function TerminalBlock({
  command,
  output,
  exitCode,
  running,
  cutShort,
  selected = false,
}: TerminalBlockProps) {
  return (
    <figure
      aria-label={`Command: ${command}`}
      className={cn(
        "overflow-auto rounded-md bg-[#0E0E11] px-3.5 py-3 font-mono text-xs leading-[1.7] whitespace-pre-wrap text-[#D9D9DE]",
        selected && "outline-2 outline-offset-2 outline-primary",
      )}
    >
      <div>
        <span className="text-[#8E8E97]">$ </span>
        {command}
      </div>
      {output && output !== "(no output)" && <div>{output}</div>}
      <div className="text-[#8E8E97]">
        {running
          ? "running…"
          : [
              cutShort && "cut short: the start of the output is shown",
              exitCode !== null && `exit code ${exitCode}`,
            ]
              .filter(Boolean)
              .join(" · ")}
      </div>
    </figure>
  );
}
