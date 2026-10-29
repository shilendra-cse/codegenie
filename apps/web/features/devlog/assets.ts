import { existsSync } from "node:fs";
import path from "node:path";

const PUBLIC_DIR = path.join(process.cwd(), "public");
const FILE_NAME = /^[\w-][\w.-]*$/;

export function devlogAssetUrl(
  slug: string,
  file: string,
  publicDir = PUBLIC_DIR,
): string {
  const folder = `/devlog-assets/${slug}/`;
  if (!FILE_NAME.test(file)) {
    throw new Error(`${slug}.mdx: "${file}" must be a file name in ${folder}`);
  }
  const url = `${folder}${file}`;
  if (!existsSync(path.join(publicDir, url))) {
    throw new Error(`${slug}.mdx: ${url} doesn't exist in public/`);
  }
  return url;
}
