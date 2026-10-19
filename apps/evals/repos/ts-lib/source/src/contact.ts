import { fetchUser } from "./users.ts";

export function contactLine(id: number): string | null {
  const user = fetchUser(id);
  if (!user) return null;
  return `${user.name} <${user.email}>`;
}
