import type { GitHubRepo } from "@hobai/shared";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { LanguageDot } from "@/components/atoms/language-dot";
import { Tooltip } from "@/components/atoms/tooltip";
import { timeAgo } from "@/lib/format";
import { projectPath } from "@/lib/routes";

const SUPPORTED = ["TypeScript", "JavaScript"];
const UNSUPPORTED = `${PRODUCT_NAME} supports JavaScript and TypeScript.`;

export type RepositoryRowProps = {
  repo: Pick<
    GitHubRepo,
    "name" | "private" | "language" | "updatedAt" | "projectId"
  >;
  adding: boolean;
  error?: string;
  onAdd: () => void;
};

export function RepositoryRow({
  repo,
  adding,
  error,
  onAdd,
}: RepositoryRowProps) {
  // GitHub reports no language until it has analysed the code, so only a known other language warns.
  const unsupported =
    !repo.projectId &&
    Boolean(repo.language) &&
    !SUPPORTED.includes(repo.language ?? "");
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-4 py-3.5 last:border-b-0 hover:bg-muted">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{repo.name}</span>
          {repo.private && <Badge>Private</Badge>}
          {unsupported && (
            <Tooltip content={UNSUPPORTED}>
              <span
                tabIndex={0}
                className="rounded-full focus-visible:outline-2 focus-visible:outline-primary"
              >
                <Badge tone="warn">
                  <Icon icon={TriangleAlert} size={14} />
                  Not JS/TS
                </Badge>
              </span>
            </Tooltip>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[13px] text-faint">
          {repo.language && (
            <span className="inline-flex items-center gap-1.5">
              <LanguageDot language={repo.language} />
              {repo.language}
            </span>
          )}
          {repo.updatedAt && <span>Updated {timeAgo(repo.updatedAt)}</span>}
        </div>
        {error && (
          <span role="alert" className="text-[13px] text-err">
            {error}
          </span>
        )}
      </div>
      {repo.projectId ? (
        <Button asChild variant="ghost" size="sm">
          <Link href={projectPath(repo.projectId)}>Added · Open</Link>
        </Button>
      ) : (
        <Button
          size="sm"
          busy={adding}
          onClick={onAdd}
          aria-label={`Add ${repo.name}`}
        >
          Add
        </Button>
      )}
    </div>
  );
}
