import { APP_HOME } from "./routes";

export function safeNext(next: string | null | undefined): string {
  if (
    next?.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return APP_HOME;
}
