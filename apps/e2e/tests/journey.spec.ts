import { createHmac, randomUUID } from "node:crypto";
import { writeFileSync } from "node:fs";
import { E2E_GITHUB } from "@hobai/github/testing";
import { expect, test, type Page } from "@playwright/test";
import { PRODUCT_NAME } from "@hobai/shared/brand";
import {
  API_URL,
  INSTALLED_FLAG,
  WEB_URL,
  WEBHOOK_SECRET,
} from "../src/environment.js";
import { JOURNEY } from "../src/journey.js";

const { repo } = E2E_GITHUB;
const prUrl = `https://github.com/${repo.owner}/${repo.name}/pull/${JOURNEY.prNumber}`;

// One page through the whole journey: each step starts where the last one left off.
test.describe.configure({ mode: "serial" });
let page: Page;

test.beforeAll(async ({ browser }) => {
  const context = await browser.newContext();
  // GitHub's own pages are skipped: the browser goes straight back to our callbacks, as if you had approved there.
  await context.route(
    "https://github.com/login/oauth/authorize**",
    async (route) => {
      const asked = new URL(route.request().url());
      const back = new URL(asked.searchParams.get("redirect_uri")!);
      back.searchParams.set("code", "e2e-code");
      back.searchParams.set("state", asked.searchParams.get("state")!);
      await route.fulfill({ status: 302, headers: { location: back.href } });
    },
  );
  await context.route(
    `https://github.com/apps/${E2E_GITHUB.appSlug}/installations/new**`,
    async (route) => {
      writeFileSync(INSTALLED_FLAG, "");
      const asked = new URL(route.request().url());
      const back = new URL(`${WEB_URL}/api/github/installations/callback`);
      back.searchParams.set(
        "installation_id",
        String(E2E_GITHUB.installation.id),
      );
      back.searchParams.set("setup_action", "install");
      const state = asked.searchParams.get("state");
      if (state) back.searchParams.set("state", state);
      await route.fulfill({ status: 302, headers: { location: back.href } });
    },
  );
  page = await context.newPage();
});

test("sign in with GitHub", async () => {
  await page.goto("/");
  await page.getByRole("link", { name: "Sign in with GitHub" }).first().click();
  await page.getByRole("button", { name: "Continue with GitHub" }).click();
  await expect(page).toHaveURL(/\/welcome/);
});

test("install the GitHub App", async () => {
  await page.getByRole("link", { name: "Install on GitHub" }).click();
  await expect(page).toHaveURL(/\/welcome/);
  await expect(page.getByRole("status")).toHaveText("GitHub App installed.");
});

test("add a repository", async () => {
  await page.getByRole("button", { name: `Add ${repo.name}` }).click();
  await expect(
    page.getByRole("navigation").getByRole("link", { name: repo.name }),
  ).toBeVisible();
});

test("set up the environment, answering its question", async () => {
  await page.getByRole("button", { name: "Start setup" }).click();
  await expect(page.getByText(JOURNEY.setup.question)).toBeVisible({
    timeout: 60_000,
  });
  await page.getByRole("link", { name: "Answer", exact: true }).click();
  await expect(page).toHaveURL(/\/projects\/[^/]+\/environment/);

  await expect(
    page.getByRole("heading", { name: JOURNEY.setup.question }),
  ).toBeVisible();
  await page
    .getByRole("radio", { name: new RegExp(JOURNEY.setup.options[0].label) })
    .check();
  await page.getByRole("button", { name: "Answer", exact: true }).click();

  await expect(page.getByText("Saved as v1")).toBeVisible({ timeout: 120_000 });
});

test("start a task", async () => {
  await page.getByRole("link", { name: "New task" }).first().click();
  await page
    .getByRole("textbox", { name: "Task description" })
    .fill(JOURNEY.task.prompt);
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page).toHaveURL(/\/tasks\/[^/]+$/);
});

test("watch it work", async () => {
  await expect(page.getByRole("region", { name: "Working" })).toBeVisible({
    timeout: 120_000,
  });
  await expect(
    page.getByRole("button", { name: "Wrote README +2" }),
  ).toBeVisible({ timeout: 120_000 });
  await expect(
    page.getByRole("tabpanel").getByText(`Hello from ${PRODUCT_NAME}.`),
  ).toBeVisible();
});

test("get the pull request", async () => {
  const pr = page.getByRole("link", {
    name: `Open PR #${JOURNEY.prNumber} on GitHub`,
  });
  await expect(pr).toBeVisible({ timeout: 120_000 });
  await expect(pr).toHaveAttribute("href", prUrl);
  await expect(page.getByText(JOURNEY.task.summary).first()).toBeVisible();
});

test("find it in the Inbox and on the project page", async () => {
  await page.goto("/inbox?filter=pr");
  const row = page
    .getByRole("main")
    .getByRole("link", { name: new RegExp(JOURNEY.task.title) });
  await expect(row).toContainText("Checks passing · 1 file changed");

  await page
    .getByRole("navigation")
    .getByRole("link", { name: `${repo.name}, ready` })
    .click();
  await expect(
    page.getByRole("row", { name: new RegExp(JOURNEY.task.title) }),
  ).toContainText(`#${JOURNEY.prNumber}`);
});

test("see it merged", async ({ request }) => {
  const body = JSON.stringify({
    action: "closed",
    pull_request: { number: JOURNEY.prNumber, state: "closed", merged: true },
    repository: { id: repo.id, full_name: `${repo.owner}/${repo.name}` },
  });
  const signature = `sha256=${createHmac("sha256", WEBHOOK_SECRET).update(body).digest("hex")}`;
  const response = await request.post(`${API_URL}/api/github/webhooks`, {
    data: body,
    headers: {
      "content-type": "application/json",
      "x-github-event": "pull_request",
      "x-github-delivery": randomUUID(),
      "x-hub-signature-256": signature,
    },
  });
  expect(response.ok()).toBe(true);

  await page.goto("/inbox?filter=done");
  await expect(
    page
      .getByRole("main")
      .getByRole("link", { name: new RegExp(JOURNEY.task.title) }),
  ).toContainText(`Merged into ${repo.defaultBranch}`);
});
