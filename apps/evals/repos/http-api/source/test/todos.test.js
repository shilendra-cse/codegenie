import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";

let server;
let base;

before(async () => {
  server = createApp().listen(0);
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => server.close());

test("lists todos", async () => {
  const res = await fetch(`${base}/todos`);
  assert.equal(res.status, 200);
  assert.equal((await res.json()).length, 2);
});

test("returns 404 for unknown routes", async () => {
  const res = await fetch(`${base}/nope`);
  assert.equal(res.status, 404);
});
