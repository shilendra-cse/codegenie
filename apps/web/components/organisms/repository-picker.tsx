"use client";

import type { GitHubInstallation, GitHubRepo } from "@hobai/shared";
import { ExternalLink, Search } from "lucide-react";
import { useState } from "react";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Input } from "@/components/atoms/input";
import { Skeleton } from "@/components/atoms/skeleton";
import { AccountPicker } from "@/components/molecules/account-picker";
import { RepositoryRow } from "@/components/molecules/repository-row";

export type RepositoryPickerProps = {
  /** Both lists are `undefined` while loading. */
  installations: GitHubInstallation[] | undefined;
  selectedId: number | undefined;
  onSelect: (installationId: number) => void;
  repositories: GitHubRepo[] | undefined;
  failed: boolean;
  onRetry: () => void;
  installUrl: string;
  manageUrl: string | undefined;
  adding: ReadonlySet<number>;
  errors: ReadonlyMap<number, string>;
  onAdd: (repoId: number) => void;
};

const card = "overflow-hidden rounded-lg border border-border bg-card";

function Loading() {
  return (
    <div aria-busy aria-label="Loading repositories" className={card}>
      {[0, 1, 2, 3].map((row) => (
        <div
          key={row}
          className="flex flex-col gap-2 border-b border-border px-4 py-4 last:border-b-0"
        >
          <Skeleton className="h-4 w-40" />
          <Skeleton className="h-3.5 w-56" />
        </div>
      ))}
    </div>
  );
}

function Failed({ onRetry }: { onRetry: () => void }) {
  return (
    <Alert tone="error" className="flex flex-wrap items-center gap-3">
      <span className="flex-1">We couldn&apos;t load your repositories.</span>
      <Button size="sm" onClick={onRetry}>
        Try again
      </Button>
    </Alert>
  );
}

export function RepositoryPicker(props: RepositoryPickerProps) {
  const [query, setQuery] = useState("");

  if (props.failed && !props.installations) {
    return <Failed onRetry={props.onRetry} />;
  }
  if (!props.installations) return <Loading />;
  if (props.installations.length === 0) {
    return (
      <div className={`${card} flex flex-col items-start gap-3 p-6`}>
        <span className="font-semibold">
          Install the GitHub App to see your repositories
        </span>
        <span className="text-muted-foreground">
          Choose which repositories {PRODUCT_NAME} can see. You can change the
          selection on GitHub at any time.
        </span>
        <Button asChild variant="primary" glow>
          <a href={props.installUrl}>Install on GitHub</a>
        </Button>
      </div>
    );
  }

  const search = query.trim().toLowerCase();
  const shown = props.repositories?.filter((repo) =>
    repo.name.toLowerCase().includes(search),
  );

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap gap-2.5">
        {props.selectedId !== undefined && (
          <AccountPicker
            installations={props.installations}
            selectedId={props.selectedId}
            onSelect={props.onSelect}
          />
        )}
        <div className="min-w-0 flex-[1_1_240px]">
          <Input
            type="search"
            icon={Search}
            aria-label="Search repositories"
            placeholder="Search repositories"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
      </div>

      {props.failed ? (
        <Failed onRetry={props.onRetry} />
      ) : !shown ? (
        <Loading />
      ) : (
        <div className={card}>
          {shown.map((repo) => (
            <RepositoryRow
              key={repo.id}
              repo={repo}
              adding={props.adding.has(repo.id)}
              error={props.errors.get(repo.id)}
              onAdd={() => props.onAdd(repo.id)}
            />
          ))}
          {shown.length === 0 && (
            <p className="px-4 py-10 text-center text-muted-foreground">
              {search
                ? `No repositories match "${query.trim()}".`
                : `No repositories are shared with ${PRODUCT_NAME} on this account.`}
            </p>
          )}
        </div>
      )}

      {props.manageUrl && (
        <p className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
          Missing a repository?
          <a
            href={props.manageUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 font-medium text-primary-text hover:underline"
          >
            Change which repositories {PRODUCT_NAME} can access on GitHub
            <Icon icon={ExternalLink} size={14} />
          </a>
        </p>
      )}
    </div>
  );
}
