import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { githubAccessToken } from "../github/github.service";
import { createProjectControllers } from "./projects.controller";

const projects = createProjectControllers({
  db,
  githubToken: githubAccessToken,
});

api.get("/projects").authSecure(projects.listProjects);
api.post("/projects").authSecure(projects.addProject);
api.get("/projects/:id").authSecure(projects.getProject);
