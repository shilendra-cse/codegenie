import type {
  CheckComparison,
  CheckStatus,
  FinalRunStatus,
  RunEvent,
  RunStage,
} from "@codegenie/shared";

/** The stages the page shows; Prepare covers the sandbox and the clone. */
export type StageId = "prepare" | "setup" | "working" | "checks" | "pr";
export type StageState =
  | "pending"
  | "running"
  | "done"
  | "failed"
  | "stopped"
  | "skipped";

export type StageView = {
  id: StageId;
  state: StageState;
  startedAt: string | null;
  endedAt: string | null;
};

export type ToolItem = {
  id: string;
  tool: string;
  target: string | null;
  running: boolean;
};

export type Activity = { id: string; running: boolean; failed: boolean } & (
  | {
      kind: "explored";
      reads: number;
      searches: number;
      listings: number;
      items: ToolItem[];
    }
  | {
      kind: "edit";
      path: string;
      /** write_file replaces the whole file; edit_file a part of it. The row's first call decides. */
      whole: boolean;
      added: number;
      removed: number;
      /** Consecutive edits to the same file share one row; this counts the ones that worked. */
      edits: number;
    }
  | { kind: "command"; command: string; exitCode: number | null }
  | { kind: "checks"; passing: number; failing: number }
  | { kind: "tool"; tool: string; target: string | null }
);

export type FileTouched = { path: string; added: number; removed: number };

export type CommandView = {
  id: string;
  command: string;
  output: string | null;
  exitCode: number | null;
  running: boolean;
  /** The run reported only the start of its output. */
  cutShort: boolean;
};

export type CheckView = {
  name: string;
  cwd: string;
  command: string | null;
  before: CheckStatus | null;
  after: CheckStatus | null;
  comparison: CheckComparison | null;
};

export type RunView = {
  stages: StageView[];
  activity: Activity[];
  files: FileTouched[];
  commands: CommandView[];
  checks: CheckView[];
  /** The checks have run again after the agent's work. */
  checksDone: boolean;
  checksPassed: boolean | null;
  setupOk: boolean | null;
  branch: string | null;
  pullRequest: { number: number; url: string; draft: boolean } | null;
  title: string | null;
  error: string | null;
  status: FinalRunStatus | null;
};

const STAGE_OF: Record<RunStage, StageId> = {
  prepare: "prepare",
  checkout: "prepare",
  setup: "setup",
  agent: "working",
  verify: "checks",
  deliver: "pr",
};
const ORDER: StageId[] = ["prepare", "setup", "working", "checks", "pr"];
const EXPLORING = new Set(["read_file", "search", "list_files"]);
// Shown elsewhere: the agent's last call ends its work.
const HIDDEN = new Set(["finish_task"]);
// The run reports at most 2,000 characters of a tool's output, and the bash tool shortens long output itself.
const CUT_SHORT = /… \[\d+ more characters\]$|Output was shortened\./;

const countLines = (text: unknown) =>
  typeof text === "string" && text !== ""
    ? text.replace(/\n$/, "").split("\n").length
    : 0;

const field = (input: unknown, key: string) => {
  const value = (input as Record<string, unknown> | undefined)?.[key];
  return typeof value === "string" ? value : null;
};

const isError = (output: unknown) =>
  typeof output === "string" && output.startsWith("Error:");

function commandResult(output: unknown) {
  if (typeof output !== "string") return { exitCode: null, text: null };
  const match = /^Exit code: (-?\d+)\n?/.exec(output);
  return match
    ? { exitCode: Number(match[1]), text: output.slice(match[0].length) }
    : { exitCode: null, text: output };
}

type EditCall = {
  added: number;
  removed: number;
  running: boolean;
  failed: boolean;
};

function summarizeEdits(
  row: Extract<Activity, { kind: "edit" }>,
  calls: EditCall[],
  ended: boolean,
) {
  const worked = calls.filter((c) => !c.running && !c.failed);
  row.running = !ended && calls.some((c) => c.running);
  row.failed = calls.every((c) => c.failed);
  row.edits = worked.length;
  row.added = worked.reduce((sum, c) => sum + c.added, 0);
  row.removed = worked.reduce((sum, c) => sum + c.removed, 0);
}

/** Works out everything the run's page shows from its events, in order. Pure. */
export function buildRunView(events: RunEvent[]): RunView {
  const stages = new Map<StageId, StageView>(
    ORDER.map((id) => [
      id,
      { id, state: "pending", startedAt: null, endedAt: null },
    ]),
  );
  let current: StageView | null = null;
  const activity: Activity[] = [];
  const byCall = new Map<string, Activity>();
  const items = new Map<string, ToolItem>();
  const commands = new Map<string, CommandView>();
  const edits: { path: string; added: number; removed: number }[] = [];
  const editCalls = new Map<string, EditCall>();
  const rowCalls = new Map<string, EditCall[]>();
  const checks = new Map<string, CheckView>();
  const view: Omit<
    RunView,
    "stages" | "activity" | "files" | "commands" | "checks"
  > = {
    checksDone: false,
    checksPassed: null,
    setupOk: null,
    branch: null,
    pullRequest: null,
    title: null,
    error: null,
    status: null,
  };

  for (const event of events) {
    switch (event.type) {
      case "stage_changed": {
        const next = stages.get(STAGE_OF[event.stage])!;
        if (next === current) break;
        if (current) {
          current.state = "done";
          current.endedAt = event.ts;
        }
        next.state = "running";
        next.startedAt = event.ts;
        current = next;
        break;
      }
      case "setup_completed":
        if (event.phase) break;
        view.setupOk = event.success;
        for (const check of event.checks) {
          checks.set(`${check.cwd}:${check.name}`, {
            name: check.name,
            cwd: check.cwd,
            command: check.command ?? null,
            before: check.status ?? null,
            after: null,
            comparison: null,
          });
        }
        break;
      case "checks_completed":
        view.checksDone = true;
        view.checksPassed = event.passed;
        for (const check of event.checks) {
          const key = `${check.cwd}:${check.name}`;
          checks.set(key, {
            name: check.name,
            cwd: check.cwd,
            command: check.command,
            before: checks.get(key)?.before ?? null,
            after: check.status,
            comparison: check.comparison,
          });
        }
        break;
      case "tool_start": {
        if (HIDDEN.has(event.toolName)) break;
        const base = { id: event.toolCallId, running: true, failed: false };
        if (EXPLORING.has(event.toolName)) {
          const item = {
            id: event.toolCallId,
            tool: event.toolName,
            target: field(event.input, "path") ?? field(event.input, "pattern"),
            running: true,
          };
          items.set(item.id, item);
          const last = activity.at(-1);
          const group =
            last?.kind === "explored"
              ? last
              : ({
                  ...base,
                  kind: "explored",
                  reads: 0,
                  searches: 0,
                  listings: 0,
                  items: [],
                } satisfies Activity);
          if (group !== last) activity.push(group);
          group.items.push(item);
          group.running = true;
          if (event.toolName === "read_file") group.reads += 1;
          else if (event.toolName === "search") group.searches += 1;
          else group.listings += 1;
          byCall.set(item.id, group);
          break;
        }
        let row: Activity;
        if (event.toolName === "edit_file" || event.toolName === "write_file") {
          const whole = event.toolName === "write_file";
          const path = field(event.input, "path") ?? "";
          const call: EditCall = {
            added: countLines(
              field(event.input, whole ? "content" : "newString"),
            ),
            removed: whole ? 0 : countLines(field(event.input, "oldString")),
            running: true,
            failed: false,
          };
          editCalls.set(event.toolCallId, call);
          const last = activity.at(-1);
          if (last?.kind === "edit" && last.path === path) {
            rowCalls.get(last.id)!.push(call);
            byCall.set(event.toolCallId, last);
            break;
          }
          row = {
            ...base,
            kind: "edit",
            path,
            whole,
            added: 0,
            removed: 0,
            edits: 0,
          };
          rowCalls.set(row.id, [call]);
        } else if (event.toolName === "bash") {
          const command = field(event.input, "command") ?? "";
          row = { ...base, kind: "command", command, exitCode: null };
          commands.set(row.id, {
            id: row.id,
            command,
            output: null,
            exitCode: null,
            running: true,
            cutShort: false,
          });
        } else if (event.toolName === "run_checks") {
          row = { ...base, kind: "checks", passing: 0, failing: 0 };
        } else {
          row = {
            ...base,
            kind: "tool",
            tool: event.toolName,
            target: field(event.input, "path") ?? field(event.input, "command"),
          };
        }
        activity.push(row);
        byCall.set(row.id, row);
        break;
      }
      case "tool_end": {
        const row = byCall.get(event.toolCallId);
        if (!row) break;
        const failed = isError(event.output);
        if (row.kind === "explored") {
          const item = items.get(event.toolCallId);
          if (item) item.running = false;
          row.running = row.items.some((i) => i.running);
          break;
        }
        if (row.kind === "edit") {
          const call = editCalls.get(event.toolCallId)!;
          call.running = false;
          call.failed = failed;
          if (!failed) {
            edits.push({
              path: row.path,
              added: call.added,
              removed: call.removed,
            });
          }
          break;
        }
        row.running = false;
        row.failed = failed;
        if (row.kind === "command") {
          const { exitCode, text } = commandResult(event.output);
          row.exitCode = exitCode;
          row.failed = failed || (exitCode !== null && exitCode !== 0);
          const command = commands.get(row.id)!;
          Object.assign(command, {
            output: text,
            exitCode,
            running: false,
            cutShort: CUT_SHORT.test(text ?? ""),
          });
        } else if (row.kind === "checks" && typeof event.output === "string") {
          const lines = event.output.split("\n");
          row.passing = lines.filter((l) => l.startsWith("✓ ")).length;
          row.failing = lines.filter((l) => l.startsWith("✗ ")).length;
        }
        break;
      }
      case "branch_created":
        view.branch = event.branchName;
        break;
      case "pr_opened":
        view.pullRequest = {
          number: event.prNumber,
          url: event.prUrl,
          draft: event.draft,
        };
        break;
      case "task_titled":
        view.title = event.title;
        break;
      case "error":
        view.error = event.message;
        break;
      case "done": {
        view.status = event.status;
        if (current) {
          current.state =
            event.status === "failed"
              ? "failed"
              : event.status === "cancelled"
                ? "stopped"
                : "done";
          current.endedAt = event.ts;
        }
        for (const stage of stages.values()) {
          if (stage.state === "pending") stage.state = "skipped";
        }
        break;
      }
      default:
        break;
    }
  }

  for (const row of activity) {
    if (row.kind === "edit") {
      summarizeEdits(row, rowCalls.get(row.id)!, view.status !== null);
    } else if (view.status !== null) {
      // The run ended before these tools did, e.g. it was cancelled mid-command.
      row.running = false;
    }
  }
  if (view.status !== null) {
    for (const item of items.values()) item.running = false;
    for (const command of commands.values()) command.running = false;
  }

  const files = new Map<string, FileTouched>();
  for (const edit of edits) {
    const file = files.get(edit.path) ?? {
      path: edit.path,
      added: 0,
      removed: 0,
    };
    file.added += edit.added;
    file.removed += edit.removed;
    files.set(edit.path, file);
  }

  return {
    ...view,
    stages: ORDER.map((id) => stages.get(id)!),
    activity,
    files: [...files.values()],
    commands: [...commands.values()],
    checks: [...checks.values()],
  };
}
