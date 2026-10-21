import { relations } from "drizzle-orm";
import { user } from "./auth-schema";
import { githubInstallations } from "./github-installations-schema";
import { runDiffs } from "./run-diffs-schema";
import { runEvents } from "./run-events-schema";
import { runs } from "./runs-schema";
import { messages } from "./messages-schema";
import { projectEnvironments } from "./project-environments-schema";
import { projects } from "./projects-schema";
import { tasks } from "./tasks-schema";

export const githubInstallationsRelations = relations(
  githubInstallations,
  ({ one, many }) => ({
    installedBy: one(user, {
      fields: [githubInstallations.installedByUserId],
      references: [user.id],
    }),
    projects: many(projects),
  }),
);

export const projectsRelations = relations(projects, ({ one, many }) => ({
  user: one(user, { fields: [projects.userId], references: [user.id] }),
  installation: one(githubInstallations, {
    fields: [projects.installationId],
    references: [githubInstallations.id],
  }),
  tasks: many(tasks),
  environments: many(projectEnvironments),
}));

export const projectEnvironmentsRelations = relations(
  projectEnvironments,
  ({ one, many }) => ({
    project: one(projects, {
      fields: [projectEnvironments.projectId],
      references: [projects.id],
    }),
    createdBy: one(user, {
      fields: [projectEnvironments.createdByUserId],
      references: [user.id],
    }),
    runs: many(runs),
  }),
);

export const tasksRelations = relations(tasks, ({ one, many }) => ({
  project: one(projects, {
    fields: [tasks.projectId],
    references: [projects.id],
  }),
  createdBy: one(user, {
    fields: [tasks.createdByUserId],
    references: [user.id],
  }),
  runs: many(runs),
  messages: many(messages),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  task: one(tasks, { fields: [runs.taskId], references: [tasks.id] }),
  environment: one(projectEnvironments, {
    fields: [runs.environmentId],
    references: [projectEnvironments.id],
  }),
  events: many(runEvents),
  messages: many(messages),
  diff: one(runDiffs),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  task: one(tasks, { fields: [messages.taskId], references: [tasks.id] }),
  run: one(runs, { fields: [messages.runId], references: [runs.id] }),
  author: one(user, {
    fields: [messages.authorUserId],
    references: [user.id],
  }),
}));

export const runEventsRelations = relations(runEvents, ({ one }) => ({
  run: one(runs, { fields: [runEvents.runId], references: [runs.id] }),
}));

export const runDiffsRelations = relations(runDiffs, ({ one }) => ({
  run: one(runs, { fields: [runDiffs.runId], references: [runs.id] }),
}));
