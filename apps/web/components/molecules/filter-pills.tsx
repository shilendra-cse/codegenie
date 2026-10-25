export type FilterPill<K extends string> = {
  key: K;
  label: string;
  count?: number;
};

export type FilterPillsProps<K extends string> = {
  label: string;
  pills: FilterPill<K>[];
  selected: K;
  onSelect: (key: K) => void;
};

export function FilterPills<K extends string>({
  label,
  pills,
  selected,
  onSelect,
}: FilterPillsProps<K>) {
  return (
    <div role="tablist" aria-label={label} className="flex flex-wrap gap-1">
      {pills.map((pill) => (
        <button
          key={pill.key}
          type="button"
          role="tab"
          aria-selected={pill.key === selected}
          onClick={() => onSelect(pill.key)}
          className="inline-flex min-h-7 cursor-pointer items-center gap-1.5 rounded-full border border-transparent px-2.5 text-[13px] font-medium text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary aria-selected:border-border aria-selected:bg-muted aria-selected:text-foreground"
        >
          {pill.label}
          {pill.count !== undefined && (
            <>
              {" "}
              <span className="text-xs text-faint">{pill.count}</span>
            </>
          )}
        </button>
      ))}
    </div>
  );
}
