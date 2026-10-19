/** Returns one page of items. Pages start at 1. */
export function paginate<T>(items: T[], page: number, pageSize: number): T[] {
  const start = page * pageSize;
  return items.slice(start, start + pageSize);
}

export function totalPages(itemCount: number, pageSize: number): number {
  return Math.ceil(itemCount / pageSize);
}
