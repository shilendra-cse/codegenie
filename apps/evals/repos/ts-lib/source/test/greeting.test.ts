import assert from "node:assert/strict";
import { test } from "node:test";
import { contactLine } from "../src/contact.ts";
import { greet } from "../src/greeting.ts";
import { totalPages } from "../src/paginate.ts";

test("greets known users by name", () => {
  assert.equal(greet(1), "Hello, Ada!");
  assert.equal(greet(99), "Hello, stranger!");
});

test("formats a contact line", () => {
  assert.equal(contactLine(3), "Grace <grace@example.com>");
  assert.equal(contactLine(99), null);
});

test("counts pages", () => {
  assert.equal(totalPages(10, 3), 4);
  assert.equal(totalPages(0, 3), 0);
});
