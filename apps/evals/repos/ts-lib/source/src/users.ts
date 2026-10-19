export type User = { id: number; name: string; email: string };

const USERS: User[] = [
  { id: 1, name: "Ada", email: "ada@example.com" },
  { id: 2, name: "Linus", email: "linus@example.com" },
  { id: 3, name: "Grace", email: "grace@example.com" },
];

export function fetchUser(id: number): User | undefined {
  return USERS.find((user) => user.id === id);
}

export function listUsers(): User[] {
  return [...USERS];
}
