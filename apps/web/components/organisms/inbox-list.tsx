import { Button } from "@/components/atoms/button";
import { TaskRow, type TaskRowProps } from "@/components/molecules/task-row";

export type InboxRow = TaskRowProps & { id: string };

export type InboxListProps = {
  groups: { label: string; rows: InboxRow[] }[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

export function InboxList({
  groups,
  hasMore,
  loadingMore,
  onLoadMore,
}: InboxListProps) {
  return (
    <div className="flex flex-col">
      {groups.map((group) => (
        <section key={group.label} aria-label={group.label}>
          <h3 className="px-6 pt-[18px] pb-1.5 text-xs font-medium text-faint">
            {group.label}
          </h3>
          {group.rows.map(({ id, ...row }) => (
            <TaskRow key={id} {...row} />
          ))}
        </section>
      ))}
      {hasMore && (
        <div className="flex justify-center px-6 pt-5 pb-10">
          <Button size="sm" onClick={onLoadMore} busy={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
