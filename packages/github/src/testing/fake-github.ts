import { Octokit } from "@octokit/rest";

export type FakeCall = {
  method: string;
  path: string;
  authorization: string;
  body: unknown;
};
export type FakeReply = { status: number; body: unknown };

/** A fetch that answers like GitHub's API from the replies given, recording each call. */
export function fakeGithub(
  answer: (call: FakeCall, index: number) => FakeReply,
) {
  const calls: FakeCall[] = [];
  const fetch: typeof globalThis.fetch = (input, init) => {
    const url = new URL(input instanceof Request ? input.url : String(input));
    const headers = new Headers(init?.headers);
    const call = {
      method: init?.method ?? "GET",
      path: url.pathname,
      authorization: headers.get("authorization") ?? "",
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    };
    calls.push(call);
    const { status, body } = answer(call, calls.length - 1);
    const response = new Response(JSON.stringify(body), {
      status,
      headers: { "content-type": "application/json" },
    });
    // Octokit reads the URL off the response, which a constructed Response doesn't have.
    Object.defineProperty(response, "url", { value: url.href });
    return Promise.resolve(response);
  };
  return { fetch, calls };
}

export function fakeGithubClient(
  answer: (call: FakeCall, index: number) => FakeReply,
) {
  const github = fakeGithub(answer);
  return {
    client: new Octokit({ auth: "ghs_fake", request: { fetch: github.fetch } }),
    calls: github.calls,
  };
}
