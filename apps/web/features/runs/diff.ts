import type { RunDiff } from "@hobai/shared";
import { skipToken, useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export type DiffLine = {
  kind: "add" | "remove" | "context" | "hunk";
  text: string;
  /** The line's number in the new file; the old file's for a removed line. */
  number: number | null;
};

export const runDiffKey = (runId: string) => ["runs", runId, "diff"];

export async function fetchRunDiff(runId: string) {
  const { data } = await api.get<{ diff: RunDiff | null }>(
    `/runs/${runId}/diff`,
  );
  return data.diff;
}

/** A run's diff, saved when it ends: asked for only once `ended`. */
export function useRunDiff(runId: string | undefined, ended: boolean) {
  return useQuery({
    queryKey: runDiffKey(runId ?? ""),
    queryFn: runId && ended ? () => fetchRunDiff(runId) : skipToken,
    staleTime: Infinity,
  });
}

const FILE = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK = /^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@(.*)$/;

/** Splits a unified diff (`git diff`) into each file's lines, keyed by the file's path. */
export function splitPatch(patch: string): Map<string, DiffLine[]> {
  const files = new Map<string, DiffLine[]>();
  let lines: DiffLine[] | null = null;
  let oldLine = 0;
  let newLine = 0;
  let inHunk = false;

  for (const line of patch.split("\n")) {
    const file = FILE.exec(line);
    if (file) {
      lines = [];
      files.set(file[2]!, lines);
      inHunk = false;
      continue;
    }
    if (!lines) continue;
    const hunk = HUNK.exec(line);
    if (hunk) {
      oldLine = Number(hunk[1]);
      newLine = Number(hunk[2]);
      inHunk = true;
      lines.push({ kind: "hunk", text: line, number: null });
      continue;
    }
    // File headers (index, ---, +++, new file mode…) come before the first hunk.
    if (!inHunk || line.startsWith("\\")) continue;
    if (line.startsWith("+")) {
      lines.push({ kind: "add", text: line.slice(1), number: newLine++ });
    } else if (line.startsWith("-")) {
      lines.push({ kind: "remove", text: line.slice(1), number: oldLine++ });
    } else if (line.startsWith(" ")) {
      lines.push({ kind: "context", text: line.slice(1), number: newLine++ });
      oldLine++;
    }
  }
  return files;
}
