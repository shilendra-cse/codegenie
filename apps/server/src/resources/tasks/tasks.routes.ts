import { config } from "@/config";
import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { workQueue } from "@/lib/work-queue";
import { createTaskControllers } from "./tasks.controller";

const tasks = createTaskControllers({
  db,
  queue: workQueue,
  model: config.agent.model,
  dailySpendCapUsd: config.limits.dailySpendCapUsd,
});

api.post("/projects/:id/tasks").authSecure(tasks.startTask);
api.get("/tasks").authSecure(tasks.listTasks);
api.get("/tasks/:id").authSecure(tasks.getTask);
