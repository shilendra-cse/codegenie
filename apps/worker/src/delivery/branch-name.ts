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

// The id's first characters keep two tasks with the same title on different branches.
export function branchName(task: { id: string; title: string }) {
  return `codegenie/${slugify(task.title)}-${task.id.slice(0, 4)}`;
}
