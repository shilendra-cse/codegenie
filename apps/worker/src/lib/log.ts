export type Log = (
  level: "info" | "warn" | "error",
  message: string,
  data?: Record<string, unknown>,
) => void;
