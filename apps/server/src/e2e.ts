// Starts the API for the end-to-end test (apps/e2e): GitHub is answered by a fake, everything else is real.
import { generateKeyPairSync } from "node:crypto";
import { existsSync } from "node:fs";
import { e2eGithubFetch } from "@hobai/github/testing";

const installedFlag = process.env.E2E_GITHUB_INSTALLED_FLAG;
if (!installedFlag) throw new Error("E2E_GITHUB_INSTALLED_FLAG is not set.");

globalThis.fetch = e2eGithubFetch(globalThis.fetch, {
  installed: () => existsSync(installedFlag),
  onCall: (call) =>
    process.stdout.write(
      `[fake github] ${call.method} ${call.url} → ${call.status}\n`,
    ),
});

// Only signs the App's tokens, which the fake doesn't check; a fresh key keeps real keys out of the test.
process.env.GITHUB_APP_PRIVATE_KEY = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  privateKeyEncoding: { type: "pkcs8", format: "pem" },
  publicKeyEncoding: { type: "spki", format: "pem" },
}).privateKey;

await import("./index.js");
