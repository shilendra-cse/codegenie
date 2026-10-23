import { Check, GitPullRequest } from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Icon } from "@/components/atoms/icon";

const STEPS = [
  { label: "Set up", detail: "pnpm install · 3 checks" },
  { label: "Edited 3 files", detail: "+79 −2", mono: true },
  { label: "lint, typecheck, test", detail: "all passing" },
];

const DIFF = [
  'router.get("/health", async (_req, res) => {',
  "  const db = await checkDatabase();",
  "  res.status(db.ok ? 200 : 503).json({ db });",
  "});",
];

export function ProductPreview() {
  return (
    <section
      aria-label="Product preview"
      className="mx-auto max-w-[1160px] px-6 pb-24"
    >
      <div className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
          <span className="font-mono text-xs text-faint">dodesk</span>
          <span className="text-xs text-faint">/</span>
          <span className="text-[13px] font-medium">
            Add a /health endpoint
          </span>
          <span className="flex-1" />
          <Badge tone="ok">
            <Icon icon={GitPullRequest} size={14} />
            PR #42 open
          </Badge>
        </div>
        <div className="flex flex-wrap">
          <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-[18px] p-7">
            <p className="max-w-[520px] self-end rounded-lg bg-muted px-3.5 py-3">
              Add a GET /health endpoint that returns 200 with the database
              status, and 503 when the database is down. Add tests.
            </p>
            <div className="flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Badge tone="ok">
                  <Icon icon={Check} size={14} />
                  Succeeded
                </Badge>
                <span className="text-xs text-faint">
                  6m 40s · 23 steps · $0.14
                </span>
              </div>
              <ul className="flex flex-col gap-1.5 text-[13px]">
                {STEPS.map((step) => (
                  <li key={step.label} className="flex items-center gap-2">
                    <Icon icon={Check} className="text-ok" />
                    <span>{step.label}</span>
                    <span
                      className={
                        step.mono ? "font-mono text-faint" : "text-faint"
                      }
                    >
                      {step.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
          <div className="min-w-0 flex-[1_1_360px] border-l border-border bg-surface p-5">
            <div className="mb-2.5 text-xs text-faint">
              src/routes/health.ts
            </div>
            <pre className="overflow-x-auto rounded-md border border-border bg-code p-3 font-mono text-xs leading-[1.7]">
              {DIFF.map((line) => (
                <span key={line} className="block bg-add whitespace-pre-wrap">
                  + {line}
                </span>
              ))}
            </pre>
          </div>
        </div>
      </div>
    </section>
  );
}
