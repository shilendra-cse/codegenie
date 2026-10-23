import { relations } from "drizzle-orm";
import { user } from "./auth/auth-schema";
import { githubInstallations } from "./github/github-installations-schema";
import { runDiffs } from "./runs/run-diffs-schema";
import { runEvents } from "./runs/run-events-schema";
import { runs } from "./runs/runs-schema";
import { messages } from "./tasks/messages-schema";
import { onboardingEvents } from "./projects/onboarding-events-schema";
import { onboardings } from "./projects/onboardings-schema";
import { projectEnvironments } from "./projects/project-environments-schema";
import { projects } from "./projects/projects-schema";
import { tasks } from "./tasks/tasks-schema";

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
  onboardings: many(onboardings),
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

export const onboardingsRelations = relations(onboardings, ({ one, many }) => ({
  project: one(projects, {
    fields: [onboardings.projectId],
    references: [projects.id],
  }),
  createdBy: one(user, {
    fields: [onboardings.createdByUserId],
    references: [user.id],
  }),
  environment: one(projectEnvironments, {
    fields: [onboardings.environmentId],
    references: [projectEnvironments.id],
  }),
  events: many(onboardingEvents),
}));

export const onboardingEventsRelations = relations(
  onboardingEvents,
  ({ one }) => ({
    onboarding: one(onboardings, {
      fields: [onboardingEvents.onboardingId],
      references: [onboardings.id],
    }),
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
