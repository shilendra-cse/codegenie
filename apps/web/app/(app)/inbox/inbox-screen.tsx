"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Alert } from "@/components/atoms/alert";
import { Button } from "@/components/atoms/button";
import { Icon } from "@/components/atoms/icon";
import { Skeleton } from "@/components/atoms/skeleton";
import { FilterPills } from "@/components/molecules/filter-pills";
import { InboxList, type InboxRow } from "@/components/organisms/inbox-list";
import { TopBar } from "@/components/organisms/top-bar";
import { useSetupsNeedingYou } from "@/features/projects/use-setups-needing-you";
import {
  groupByDay,
  type InboxFilter,
  parseInboxFilter,
} from "@/features/tasks/inbox";
import { useTaskPages } from "@/features/tasks/use-task-pages";
import { useHasTasks, useTaskCounts } from "@/features/tasks/use-tasks";
import { INBOX, NEW_TASK, WELCOME } from "@/lib/routes";
import { setupRow, taskRow } from "./inbox-rows";

const URL_FILTERS: Record<InboxFilter, string | null> = {
  all: null,
  needs_you: "needs-you",
  running: "running",
  pr: "pr",
  done: "done",
};

export type InboxScreenProps = { filter?: string };

export function InboxScreen({ filter: param }: InboxScreenProps) {
  const router = useRouter();
  const [filter, setFilter] = useState(() => parseInboxFilter(param));
  const now = Date.now();
  const hasTasks = useHasTasks();
  const counts = useTaskCounts().data;
  const setups = useSetupsNeedingYou();
  const onlySetups = filter === "needs_you";
  const pages = useTaskPages({
    filter: filter === "all" || onlySetups ? undefined : filter,
    enabled: !onlySetups,
  });

  useEffect(() => {
    if (hasTasks.data === false) router.replace(WELCOME);
  }, [hasTasks.data, router]);

  const select = (next: InboxFilter) => {
    setFilter(next);
    const url = URL_FILTERS[next];
    router.replace(url ? `${INBOX}?filter=${url}` : INBOX, { scroll: false });
  };

  const setupRows =
    filter === "all" || onlySetups
      ? setups.map((setup) => setupRow(setup, now))
      : [];
  const groups: { label: string; rows: InboxRow[] }[] = onlySetups
    ? []
    : groupByDay(pages.tasks ?? [], new Date(now)).map((group) => ({
        label: group.label,
        rows: group.items.map((task) => taskRow(task, now)),
      }));
  if (setupRows.length > 0) {
    if (groups[0]?.label === "Today") groups[0].rows.unshift(...setupRows);
    else groups.unshift({ label: "Today", rows: setupRows });
  }

  const loading = hasTasks.data !== true || (!onlySetups && pages.isPending);
  const empty = !loading && !pages.isError && groups.length === 0;

  return (
    <>
      <TopBar title="Inbox">
        <span className="flex-1" />
        <Button asChild size="sm" variant="primary" glow>
          <Link href={NEW_TASK}>
            <Icon icon={Plus} size={14} />
            New task
          </Link>
        </Button>
      </TopBar>
      <div className="border-b border-border bg-background px-[18px] py-3">
        <FilterPills
          label="Filter"
          selected={filter}
          onSelect={select}
          pills={[
            {
              key: "all",
              label: "All",
              count: counts && counts.all + setups.length,
            },
            { key: "needs_you", label: "Needs you", count: setups.length },
            { key: "running", label: "Running", count: counts?.running },
            { key: "pr", label: "PR open", count: counts?.pr },
            { key: "done", label: "Done", count: counts?.done },
          ]}
        />
      </div>
      {loading ? (
        <div aria-busy className="flex flex-col gap-4 px-6 py-5">
          {[0, 1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-10 w-full rounded-md" />
          ))}
        </div>
      ) : pages.isError && !onlySetups ? (
        <Alert tone="error" className="mx-6 mt-5">
          Couldn&apos;t load your tasks.{" "}
          <button
            type="button"
            className="font-medium underline underline-offset-2"
            onClick={() => void pages.refetch()}
          >
            Try again
          </button>
        </Alert>
      ) : empty ? (
        <div className="flex flex-col items-center gap-2 px-6 py-20 text-center">
          <span className="font-semibold">Nothing here</span>
          <span className="text-muted-foreground">
            No tasks match this filter.
          </span>
        </div>
      ) : (
        <InboxList
          groups={groups}
          hasMore={!onlySetups && Boolean(pages.hasMore)}
          loadingMore={pages.loadingMore}
          onLoadMore={() => void pages.loadMore()}
        />
      )}
    </>
  );
}
