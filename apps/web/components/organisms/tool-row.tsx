const TOOLS = ["npm", "pnpm", "yarn", "TypeScript", "ESLint", "Vitest", "Jest"];

export function ToolRow() {
  return (
    <section
      aria-labelledby="tools-title"
      className="reveal mx-auto flex max-w-[1160px] flex-col items-center gap-3.5 px-6 pb-[88px]"
    >
      <p id="tools-title" className="text-[13px] text-faint">
        Sets up the tools your repository already uses
      </p>
      <ul className="flex flex-wrap justify-center gap-2">
        {TOOLS.map((tool) => (
          <li
            key={tool}
            className="flex h-[30px] items-center rounded-full border border-border bg-card px-3 font-mono text-[13px] text-muted-foreground"
          >
            {tool}
          </li>
        ))}
      </ul>
    </section>
  );
}
