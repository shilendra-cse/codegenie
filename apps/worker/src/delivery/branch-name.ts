const MAX_SLUG = 40;

export function slugify(title: string) {
  const slug = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .slice(0, MAX_SLUG)
    .replace(/^-+|-+$/g, "");
  return slug || "changes";
}

export function branchName(task: { id: string; title: string }) {
  return `codegenie/${task.id.slice(0, 8)}-${slugify(task.title)}`;
}
