const COLOURS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#d4b21a",
  Python: "#3572a5",
  Shell: "#5ba84e",
};

export type LanguageDotProps = { language: string };

export function LanguageDot({ language }: LanguageDotProps) {
  return (
    <span
      aria-hidden
      className="size-2 shrink-0 rounded-full bg-faint"
      style={COLOURS[language] ? { background: COLOURS[language] } : undefined}
    />
  );
}
