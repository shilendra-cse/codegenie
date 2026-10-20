import { relations } from "drizzle-orm";
import { user } from "./auth-schema";
import { githubInstallations } from "./github-installations-schema";
import { jobEvents } from "./job-events-schema";
import { jobs } from "./jobs-schema";
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
    jobs: many(jobs),
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
  jobs: many(jobs),
  messages: many(messages),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  task: one(tasks, { fields: [jobs.taskId], references: [tasks.id] }),
  environment: one(projectEnvironments, {
    fields: [jobs.environmentId],
    references: [projectEnvironments.id],
  }),
  events: many(jobEvents),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  task: one(tasks, { fields: [messages.taskId], references: [tasks.id] }),
  job: one(jobs, { fields: [messages.jobId], references: [jobs.id] }),
  author: one(user, {
    fields: [messages.authorUserId],
    references: [user.id],
  }),
}));

export const jobEventsRelations = relations(jobEvents, ({ one }) => ({
  job: one(jobs, { fields: [jobEvents.jobId], references: [jobs.id] }),
}));
