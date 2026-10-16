import { DockerSandbox } from "../providers/docker/docker-sandbox.js";

export async function dockerSandboxOrSkip(
  suite: string,
): Promise<DockerSandbox | null> {
  try {
    return await DockerSandbox.create();
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    if (process.env.CI) {
      throw new Error(
        `${suite} integration tests require Docker in CI: ${reason}`,
        { cause: error },
      );
    }
    console.warn(`Skipping ${suite} integration tests: ${reason}`);
    return null;
  }
}
