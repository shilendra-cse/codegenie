import {
  Check,
  GitPullRequest,
  Pencil,
  Search,
  SquareTerminal,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/atoms/badge";
import { Icon } from "@/components/atoms/icon";
import { Spinner } from "@/components/atoms/spinner";

const tones = { ok: "text-ok", err: "text-err", faint: "text-faint" } as const;

type Step = {
  at: number;
  icon: LucideIcon;
  iconTone: keyof typeof tones;
  label: string;
  code?: string;
  detail: string;
  detailTone: keyof typeof tones;
};

// `at` is the moment in the replayed run when a line appears (.play-N).
const STEPS: Step[] = [
  {
    at: 1,
    icon: Check,
    iconTone: "ok",
    label: "Set up",
    detail: "pnpm install · 3 checks passing",
    detailTone: "faint",
  },
  {
    at: 2,
    icon: Search,
    iconTone: "faint",
    label: "Explored the code",
    detail: "read 6 files",
    detailTone: "faint",
  },
  {
    at: 3,
    icon: Pencil,
    iconTone: "faint",
    label: "Created",
    code: "src/routes/health.ts",
    detail: "+11",
    detailTone: "ok",
  },
  {
    at: 4,
    icon: SquareTerminal,
    iconTone: "err",
    label: "Ran",
    code: "pnpm test",
    detail: "1 failing",
    detailTone: "err",
  },
  {
    at: 5,
    icon: Pencil,
    iconTone: "faint",
    label: "Created",
    code: "test/health.test.ts",
    detail: "+31",
    detailTone: "ok",
  },
  {
    at: 6,
    icon: SquareTerminal,
    iconTone: "ok",
    label: "Ran",
    code: "pnpm test",
    detail: "all passing",
    detailTone: "ok",
  },
];

const DIFF = [
  { at: 3, line: 'health.get("/health", async (_req, res) => {' },
  { at: 3, line: "  const db = await checkDatabase()" },
  { at: 4, line: "    .then(() => ({ ok: true }))" },
  { at: 4, line: "    .catch(() => ({ ok: false }));" },
  { at: 5, line: "  res.status(db.ok ? 200 : 503).json({ db });" },
  { at: 5, line: "});" },
];

const DONE = "play-7";

export function ProductPreview() {
  return (
    <section
      aria-label="Product preview"
      className="mx-auto max-w-[1160px] px-6 pb-16"
    >
      <div className="beam">
        <div className="overflow-hidden rounded-[13px] bg-card">
          <div className="flex items-center gap-2 border-b border-border bg-surface px-4 py-3">
            <span aria-hidden className="mr-1.5 flex gap-1.5">
              {[0, 1, 2].map((dot) => (
                <span
                  key={dot}
                  className="size-2.5 rounded-full bg-border-strong"
                />
              ))}
            </span>
            <span className="font-mono text-xs text-faint">dodesk</span>
            <span className="text-xs text-faint">/</span>
            <span className="text-[13px] font-medium">
              Add a /health endpoint
            </span>
            <span className="flex-1" />
            <Badge tone="ok" className={DONE}>
              <Icon icon={GitPullRequest} size={14} />
              PR #42 open
            </Badge>
          </div>
          <div className="flex min-h-[380px] flex-wrap">
            <div className="flex min-w-0 flex-[999_1_520px] flex-col gap-4 p-7">
              <p className="play-0 max-w-[520px] self-end rounded-lg bg-muted px-3.5 py-3">
                Add a GET /health endpoint that returns 200 with the database
                status, and 503 when the database is down. Add tests.
              </p>
              <div className="play-1 flex flex-col gap-2.5 rounded-lg border border-border bg-card p-4">
                <div className="flex items-center gap-2">
                  <span className="grid [&>*]:[grid-area:1/1]">
                    <span aria-hidden className="play-working">
                      <Badge tone="progress">
                        <Spinner size={14} />
                        Working
                      </Badge>
                    </span>
                    <Badge tone="ok" className={DONE}>
                      <Icon icon={Check} size={14} />
                      Succeeded
                    </Badge>
                  </span>
                  <span className="text-xs text-faint">CodeGenie · run 1</span>
                </div>
                <ul className="flex flex-col gap-[7px] text-[13px]">
                  {STEPS.map((step) => (
                    <li
                      key={step.at}
                      className={`play-${step.at} flex items-center gap-2`}
                    >
                      <Icon icon={step.icon} className={tones[step.iconTone]} />
                      <span>{step.label}</span>
                      {step.code && (
                        <span className="font-mono text-[12.5px]">
                          {step.code}
                        </span>
                      )}
                      <span className={tones[step.detailTone]}>
                        {step.detail}
                      </span>
                    </li>
                  ))}
                </ul>
                <p className="play-5 text-[13px] text-faint italic">
                  The 503 case needs the database check mocked; adding that
                  <span aria-hidden className="caret" />
                </p>
              </div>
            </div>
            <div className="flex min-w-0 flex-[1_1_360px] flex-col gap-2.5 border-l border-border bg-surface p-5">
              <div
                aria-hidden
                className="-mx-1 -mt-1 mb-1 flex gap-1 border-b border-border text-[12.5px]"
              >
                <span className="-mb-px border-b-2 border-foreground px-2 py-1.5 font-medium">
                  Changes
                </span>
                <span className="px-2 py-1.5 text-faint">Terminal</span>
                <span className="px-2 py-1.5 text-faint">Checks</span>
              </div>
              <div className="font-mono text-xs text-faint">
                src/routes/health.ts
              </div>
              <pre className="overflow-hidden rounded-md border border-border bg-code py-2.5 font-mono text-xs leading-[1.75]">
                {DIFF.map(({ at, line }) => (
                  <span
                    key={line}
                    className={`play-${at} block border-l-2 border-ok bg-add px-2.5 whitespace-pre-wrap`}
                  >
                    + {line}
                  </span>
                ))}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
