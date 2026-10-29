"use client";

import { useTheme } from "next-themes";
import {
  ArtifactEmbed,
  type ArtifactEmbedProps,
} from "@/components/molecules/artifact-embed";

export function ThemedArtifact(props: Omit<ArtifactEmbedProps, "theme">) {
  const { resolvedTheme } = useTheme();
  const theme =
    resolvedTheme === "light" || resolvedTheme === "dark"
      ? resolvedTheme
      : undefined;
  return <ArtifactEmbed {...props} theme={theme} />;
}
