import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config, middleware } from "./middleware";

const SESSION = "better-auth.session_token=abc.signature";

const request = (path: string, cookie?: string) =>
  new NextRequest(`http://localhost:3000${path}`, {
    headers: cookie ? { cookie } : {},
  });

describe("middleware", () => {
  it("guards the app's pages and nothing else", () => {
    const guarded = (url: string) =>
      unstable_doesMiddlewareMatch({ config, url });

    for (const url of [
      "/welcome",
      "/inbox",
      "/new",
      "/projects/42/settings",
      "/tasks/7",
    ]) {
      expect(guarded(url), url).toBe(true);
    }
    for (const url of [
      "/",
      "/signin",
      "/api/projects",
      "/brand/black/codegenie_icon_black.png",
    ]) {
      expect(guarded(url), url).toBe(false);
    }
  });

  it("sends a signed-out visitor to sign in, and back afterwards", () => {
    const response = middleware(request("/projects/42?tab=settings"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe(
      "http://localhost:3000/signin?next=%2Fprojects%2F42%3Ftab%3Dsettings",
    );
  });

  it("lets a visitor with a session cookie through", () => {
    const response = middleware(request("/inbox", SESSION));

    expect(response.headers.get("location")).toBeNull();
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
