export const INBOX = "/inbox";
export const APP_HOME = INBOX;
export const WELCOME = "/welcome";
export const SIGN_IN = "/signin";
export const ADD_REPOSITORY = "/projects/new";
export const NEW_TASK = "/new";

export const projectPath = (id: string) => `/projects/${id}`;
export const environmentPath = (projectId: string) =>
  `${projectPath(projectId)}/environment`;
export const taskPath = (id: string) => `/tasks/${id}`;
export const newTaskPath = (projectId: string) =>
  `${NEW_TASK}?project=${encodeURIComponent(projectId)}`;
