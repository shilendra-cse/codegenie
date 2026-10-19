import { fetchUser } from "./users.ts";

export function greet(id: number): string {
  const user = fetchUser(id);
  return user ? `Hello, ${user.name}!` : "Hello, stranger!";
}
