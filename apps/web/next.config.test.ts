import { describe, expect, it } from "vitest";
import nextConfig from "./next.config";

describe("next.config headers", () => {
  it("sandboxes everything under /devlog-assets, however it's opened", async () => {
    const rules = (await nextConfig.headers?.()) ?? [];
    const assets = rules.find(
      (rule) => rule.source === "/devlog-assets/:path*",
    );

    const csp = assets?.headers.find(
      (header) => header.key === "Content-Security-Policy",
    );
    expect(csp?.value).toMatch(/^sandbox( |$)/);
    expect(csp?.value).toContain("allow-scripts");
    expect(csp?.value).not.toContain("allow-same-origin");
  });
});
