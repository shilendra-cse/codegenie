export type ApiSuccess<Data> = {
  status: number;
  message: string;
  type: "success";
  data: Data;
};

export type ApiErrorBody = {
  status: number;
  message: string;
  type: "error";
  code?: ApiErrorCode;
  data?: unknown;
};

export type ApiErrorCode =
  | "GITHUB_SIGN_IN_REQUIRED"
  | "GITHUB_INSTALLATION_NOT_FOUND"
  | "GITHUB_INSTALLATION_SUSPENDED"
  | "GITHUB_INSTALLATION_REMOVED"
  | "GITHUB_REPOSITORY_NOT_FOUND"
  | "PROJECT_NOT_FOUND"
  | "PROJECT_BUSY"
  | "PROJECT_NOT_SET_UP"
  | "PROJECT_NEEDS_ATTENTION"
  | "TASK_NOT_FOUND"
  | "RUN_NOT_FOUND"
  | "RUN_ENDED"
  | "QUEUE_UNAVAILABLE";
