import type { GitHubRepo } from "@codegenie/shared";
import { TriangleAlert } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/atoms/badge";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { LanguageDot } from "@/components/atoms/language-dot";
import { timeAgo } from "@/lib/format";
import { projectPath } from "@/lib/routes";

const SUPPORTED = ["TypeScript", "JavaScript"];

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
  const unsupported =
    !repo.projectId && !SUPPORTED.includes(repo.language ?? "");
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-3 border-b border-border px-4 py-3.5 last:border-b-0 hover:bg-muted">
      <div className="flex min-w-0 flex-[1_1_320px] flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{repo.name}</span>
          {repo.private && <Badge>Private</Badge>}
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
        {unsupported && (
          <span className="inline-flex items-center gap-1.5 text-[13px] text-warn">
            <Icon icon={TriangleAlert} size={14} />
            Doesn&apos;t look like JavaScript or TypeScript. CodeGenie may not
            be able to set it up.
          </span>
        )}
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
