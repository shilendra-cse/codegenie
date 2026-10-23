export type FlowArrowProps = { label: string };

export function FlowArrow({ label }: FlowArrowProps) {
  return (
    <div className="flex min-w-[60px] flex-[1_1_60px] flex-col items-center gap-1 text-center text-[11.5px] text-faint">
      <span>{label}</span>
      <span
        aria-hidden
        className="flow-line relative block h-px w-full overflow-hidden"
      />
    </div>
  );
}
