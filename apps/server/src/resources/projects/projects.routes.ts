import { db } from "@/db";
import { api } from "@/lib/ApiRouter";
import { createProjectControllers } from "./projects.controller";

const projects = createProjectControllers({ db });

api.get("/projects").authSecure(projects.listProjects);
api.get("/projects/:id").authSecure(projects.getProject);
