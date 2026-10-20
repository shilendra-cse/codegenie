import type { FileEntry } from "../core/types.js";

export function findArgs(dir: string, maxDepth: number) {
  return [
    dir,
    "-mindepth",
    "1",
    "-maxdepth",
    String(maxDepth),
    "(",
    "-name",
    "node_modules",
    "-o",
    "-name",
    ".git",
    ")",
    "-prune",
    "-o",
    "-printf",
    "%y\t%s\t%p\n",
  ];
}

export function parseFindOutput(stdout: string): FileEntry[] {
  return stdout
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [type, size, ...rest] = line.split("\t");
      const isDirectory = type === "d";
      return {
        path: rest.join("\t"),
        isDirectory,
        size: isDirectory ? 0 : Number(size),
      };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}
