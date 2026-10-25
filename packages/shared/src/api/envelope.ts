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
  | "ENVIRONMENT_NOT_FOUND"
  | "SETUP_IN_PROGRESS"
  | "TASK_NOT_FOUND"
  | "RUN_NOT_FOUND"
  | "RUN_ENDED"
  | "ONBOARDING_NOT_FOUND"
  | "ONBOARDING_ENDED"
  | "QUESTION_NOT_OPEN"
  | "QUEUE_UNAVAILABLE";
