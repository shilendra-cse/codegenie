import { describe, expect, it } from "vitest";
import { installUrlFor, manageAccessUrl } from "./links";

describe("installUrlFor", () => {
  it("asks GitHub to come back to the page the install started from", () => {
    expect(
      installUrlFor(
        "https://github.com/apps/hobai/installations/new",
        "add-repo",
      ),
    ).toBe(
      "https://github.com/apps/hobai/installations/new?state=add-repo",
    );
  });

  it("keeps a query the link already has", () => {
    expect(
      installUrlFor(
        "https://github.com/apps/hobai/installations/new?x=1",
        "add-repo",
      ),
    ).toBe(
      "https://github.com/apps/hobai/installations/new?x=1&state=add-repo",
    );
  });
});

describe("manageAccessUrl", () => {
  it("points at the installation's settings for a personal account or an organisation", () => {
    expect(
      manageAccessUrl({ id: 7, accountLogin: "ada", accountType: "user" }),
    ).toBe("https://github.com/settings/installations/7");
    expect(
      manageAccessUrl({
        id: 9,
        accountLogin: "acme",
        accountType: "organization",
      }),
    ).toBe("https://github.com/organizations/acme/settings/installations/9");
  });
});
