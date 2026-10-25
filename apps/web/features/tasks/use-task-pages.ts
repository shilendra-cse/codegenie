import type { TaskFilter } from "@hobai/shared";
import { useInfiniteQuery } from "@tanstack/react-query";
import { fetchTaskPage } from "./api";
import { isTaskActive } from "./use-tasks";

const REFRESH_MS = 3_000;

export const taskPagesKey = (projectId?: string, filter?: TaskFilter) => [
  "tasks",
  "pages",
  projectId ?? "all",
  filter ?? "all",
];

export function useTaskPages({
  projectId,
  filter,
  enabled = true,
}: {
  projectId?: string;
  filter?: TaskFilter;
  enabled?: boolean;
}) {
  const query = useInfiniteQuery({
    queryKey: taskPagesKey(projectId, filter),
    queryFn: ({ pageParam }) =>
      fetchTaskPage({ projectId, filter, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (page) => page.nextCursor ?? undefined,
    enabled,
    refetchInterval: (q) =>
      q.state.data?.pages.some(
        (page) => page.counts.running > 0 || page.tasks.some(isTaskActive),
      )
        ? REFRESH_MS
        : false,
  });
  const pages = query.data?.pages;
  return {
    tasks: pages?.flatMap((page) => page.tasks),
    counts: pages?.[0]?.counts,
    isPending: query.isPending,
    isError: query.isError,
    refetch: query.refetch,
    hasMore: query.hasNextPage,
    loadMore: query.fetchNextPage,
    loadingMore: query.isFetchingNextPage,
  };
}
