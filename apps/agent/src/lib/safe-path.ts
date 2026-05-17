import path from "path";
import fs from "fs";

const PROJECT_ROOT = process.cwd();
const PROJECT_ROOT_RESOLVED = fs.realpathSync(PROJECT_ROOT);

export default function safePath(inputPath: string) {
  const candidate = path.resolve(PROJECT_ROOT, inputPath);
  const candidateResolved = fs.realpathSync(candidate);

  const rootCmp = normalizeForComparision(PROJECT_ROOT_RESOLVED);
  const candidateCmp = normalizeForComparision(candidateResolved);

  const rootCmpWithSep = rootCmp.endsWith(path.sep)
    ? rootCmp
    : rootCmp + path.sep;

  if (
    candidateCmp !== rootCmp &&
    !candidateCmp.startsWith(rootCmpWithSep)
  ) {
    throw new Error(
      `Path ${candidateResolved} is not within the security scope of ai | Error while safePath check`
    );
  }

  return candidateResolved;
}

function normalizeForComparision(filePath: string) {
  if (process.platform === "win32") {
    return filePath.toLowerCase();
  }
  return filePath;
}
