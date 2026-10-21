export class GithubConfigError extends Error {}

export function parsePrivateKey(value: string): string {
  const key = value.replaceAll("\\n", "\n").trim();
  if (!key.startsWith("-----BEGIN") || !key.includes("PRIVATE KEY-----")) {
    throw new GithubConfigError(
      "The GitHub App private key isn't a PEM key (-----BEGIN … PRIVATE KEY-----).",
    );
  }
  return `${key}\n`;
}
