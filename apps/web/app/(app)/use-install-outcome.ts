import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/** The `?github=` outcome GitHub's install sent back, kept after the address is tidied. */
export function useInstallOutcome(github: string | undefined, path: string) {
  const router = useRouter();
  const [outcome] = useState(github);

  useEffect(() => {
    if (github !== undefined) router.replace(path, { scroll: false });
  }, [github, path, router]);

  return outcome;
}
