import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/atoms/button";

export type ProjectTaskRow = {
  id: string;
  href: string;
  title: string;
  status: ReactNode;
  pullRequest: { number: number; url: string } | null;
  runs: number;
  duration: string;
  cost: string;
  updated: string;
};

export type ProjectTaskTableProps = {
  rows: ProjectTaskRow[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

const head = "px-3 py-2.5 text-xs font-medium whitespace-nowrap text-faint";
const cell = "px-3 py-[11px] whitespace-nowrap";
const number = `${cell} text-right text-faint`;

export function ProjectTaskTable({
  rows,
  hasMore,
  loadingMore,
  onLoadMore,
}: ProjectTaskTableProps) {
  return (
    <div className="rise overflow-x-auto px-3 pt-4 pb-10">
      <table className="w-full border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b border-border text-left">
            <th className={`${head} w-[46%]`}>Task</th>
            <th className={head}>Status</th>
            <th className={head}>Pull request</th>
            <th className={`${head} text-right`}>Runs</th>
            <th className={`${head} text-right`}>Duration</th>
            <th className={`${head} text-right`}>Cost</th>
            <th className={`${head} text-right`}>Updated</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={row.id}
              className="relative border-b border-border hover:bg-muted"
            >
              <td className={`${cell} max-w-0`}>
                <Link
                  href={row.href}
                  className="block truncate font-medium after:absolute after:inset-0 focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:-outline-offset-2 focus-visible:after:outline-primary"
                >
                  {row.title}
                </Link>
              </td>
              <td className={cell}>{row.status}</td>
              <td className={`${cell} font-mono text-muted-foreground`}>
                {row.pullRequest ? (
                  <a
                    href={row.pullRequest.url}
                    target="_blank"
                    rel="noreferrer"
                    className="relative z-10 hover:text-foreground"
                  >
                    #{row.pullRequest.number}
                  </a>
                ) : (
                  "—"
                )}
              </td>
              <td className={number}>{row.runs}</td>
              <td className={number}>{row.duration}</td>
              <td className={number}>{row.cost}</td>
              <td className={number}>{row.updated}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {hasMore && (
        <div className="flex justify-center pt-5">
          <Button size="sm" onClick={onLoadMore} busy={loadingMore}>
            Load more
          </Button>
        </div>
      )}
    </div>
  );
}
