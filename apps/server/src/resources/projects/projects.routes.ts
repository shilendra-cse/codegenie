import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { workQueue } from "@/lib/work-queue";
import { githubAccessToken } from "../github/github.service";
import { createProjectControllers } from "./projects.controller";

const projects = createProjectControllers({
  db,
  githubToken: githubAccessToken,
  queue: workQueue,
});

api.get("/projects").authSecure(projects.listProjects);
api.post("/projects").authSecure(projects.addProject);
api.get("/projects/:id").authSecure(projects.getProject);
api.delete("/projects/:id").authSecure(projects.deleteProject);
api.post("/projects/:id/onboarding").authSecure(projects.startSetup);
