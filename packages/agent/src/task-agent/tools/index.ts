import { bashTool } from "../../tools/bash/bash.js";
import type { ToolContext } from "../../tools/core/context.js";
import { editFileTool } from "./edit-file/edit-file.js";
import { finishTaskTool } from "./finish-task/finish-task.js";
import { listFilesTool } from "../../tools/list-files/list-files.js";
import { readFileTool } from "../../tools/read-file/read-file.js";
import { runChecksTool } from "./run-checks/run-checks.js";
import { searchTool } from "../../tools/search/search.js";
import { writeFileTool } from "./write-file/write-file.js";

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
