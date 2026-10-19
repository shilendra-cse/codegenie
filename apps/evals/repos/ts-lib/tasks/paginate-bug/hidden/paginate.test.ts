import assert from "node:assert/strict";
import { test } from "node:test";
import { paginate } from "../src/paginate.ts";

const items = [1, 2, 3, 4, 5, 6, 7];

test("page 1 starts at the first item", () => {
  assert.deepEqual(paginate(items, 1, 3), [1, 2, 3]);
});

test("later pages continue where the previous one ended", () => {
  assert.deepEqual(paginate(items, 2, 3), [4, 5, 6]);
  assert.deepEqual(paginate(items, 3, 3), [7]);
});

test("pages past the end are empty", () => {
  assert.deepEqual(paginate(items, 4, 3), []);
});
