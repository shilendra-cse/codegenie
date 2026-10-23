const AFTER_SIGN_IN = "/build";

export function safeNext(next: string | null | undefined): string {
  if (
    next?.startsWith("/") &&
    !next.startsWith("//") &&
    !next.startsWith("/\\")
  ) {
    return next;
  }
  return AFTER_SIGN_IN;
}
