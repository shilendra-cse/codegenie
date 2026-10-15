import { DockerSandbox } from "@codegenie/sandbox";

/**
 * Starts a real DockerSandbox for an integration test file, or returns null so the
 * file can skip. In CI a missing Docker/image is a failure, never a silent skip.
 */
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
