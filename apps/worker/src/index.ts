// Job runner: consumes queued jobs and runs the agent pipeline in a sandbox.
// Phase 2 adds the BullMQ consumer and the pipeline (docs/knowledge/architecture.md §5).

console.log("CodeGenie worker started (no queue consumer yet)");
