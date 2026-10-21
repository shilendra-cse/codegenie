const GITHUB_TOKEN = /\b(gh[opsur]_|github_pat_)[A-Za-z0-9_]{20,}/g;

export function redactGithubTokens(text: string): string {
  return text.replace(GITHUB_TOKEN, "$1***");
}

export function redactGithubTokensIn<T>(value: T): T {
  return JSON.parse(redactGithubTokens(JSON.stringify(value))) as T;
}
