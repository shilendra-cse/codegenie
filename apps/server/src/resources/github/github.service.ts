import { auth } from "@/lib/auth";

export async function githubAccessToken(
  userId: string,
): Promise<string | null> {
  try {
    const tokens = await auth.api.getAccessToken({
      body: { providerId: "github", userId },
    });
    return tokens.accessToken ?? null;
  } catch {
    return null;
  }
}
