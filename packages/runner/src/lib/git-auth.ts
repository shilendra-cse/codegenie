// Git reads GIT_CONFIG_* as config for this one command: nothing lands in .git/config or the command line.
export function gitAuthEnv(token: string): Record<string, string> {
  const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
  return {
    GIT_CONFIG_COUNT: "1",
    GIT_CONFIG_KEY_0: "http.extraHeader",
    GIT_CONFIG_VALUE_0: `AUTHORIZATION: basic ${basic}`,
  };
}
