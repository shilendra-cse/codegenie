import { bashTool } from "./bash/bash.js";
import type { ToolContext } from "./core/context.js";
import { editFileTool } from "./edit-file/edit-file.js";
import { finishTaskTool } from "./finish-task/finish-task.js";
import { listFilesTool } from "./list-files/list-files.js";
import { readFileTool } from "./read-file/read-file.js";
import { runChecksTool } from "./run-checks/run-checks.js";
import { searchTool } from "./search/search.js";
import { writeFileTool } from "./write-file/write-file.js";

/** The tools the model can call, all bound to one run's sandbox and state. */
export function createTools(ctx: ToolContext) {
  return {
    list_files: listFilesTool(ctx),
    read_file: readFileTool(ctx),
    search: searchTool(ctx),
    edit_file: editFileTool(ctx),
    write_file: writeFileTool(ctx),
    bash: bashTool(ctx),
    run_checks: runChecksTool(ctx),
    finish_task: finishTaskTool(),
  };
}

export type AgentTools = ReturnType<typeof createTools>;
export type AgentToolName = keyof AgentTools;

export { createToolContext, type ToolContext } from "./core/context.js";
