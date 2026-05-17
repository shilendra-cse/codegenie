import fg from "fast-glob";

const MAX_GLOB_PATTERN_LENGTH = 200;

const DANGEROUS_PATTERNS = [
  /\.\./,
  /^\/.*root/,
  /^\/etc/,
  /^\/usr/,
  /^\/bin/,
  /^\/sbin/,
  /^\/var/,
  /^\*\*\/\*\*.*\*\*/,
  /\{.*\{.*\}/,
];

export function validateGlobPattern(pattern: string): {
  valid: boolean;
  error?: string;
} {
  if (pattern.length > MAX_GLOB_PATTERN_LENGTH) {
    return { valid: false, error: "Pattern exceeds maximum length" };
  }

  const cleanPattern = sanitizeGlobPattern(pattern);

  for (const dangerous of DANGEROUS_PATTERNS) {
    if (dangerous.test(cleanPattern)) {
      return {
        valid: false,
        error: "Pattern contains potentially dangerous sequences",
      };
    }
  }

  try {
    fg.generateTasks(cleanPattern, { cwd: process.cwd() });
  } catch {
    return { valid: false, error: "Invalid glob pattern" };
  }

  return { valid: true };
}

export function sanitizeGlobPattern(pattern: string): string {
  pattern = pattern.replace(/[\x00-\x1F\x7F]/g, "");
  pattern = pattern.replace(/\\/g, "/");
  pattern = pattern.replace(/\*{10,}/g, "*********");
  return pattern;
}
