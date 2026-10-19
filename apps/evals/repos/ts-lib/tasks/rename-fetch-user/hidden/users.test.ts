import assert from "node:assert/strict";
import { test } from "node:test";
import { contactLine } from "../src/contact.ts";
import { greet } from "../src/greeting.ts";
import * as users from "../src/users.ts";

test("users are looked up with getUser", () => {
  assert.equal(typeof (users as Record<string, unknown>).getUser, "function");
  assert.equal("fetchUser" in users, false);
  const getUser = (users as unknown as { getUser: (id: number) => unknown }).getUser;
  assert.deepEqual(getUser(2), { id: 2, name: "Linus", email: "linus@example.com" });
});

test("callers still work", () => {
  assert.equal(greet(1), "Hello, Ada!");
  assert.equal(contactLine(3), "Grace <grace@example.com>");
});
