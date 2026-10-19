import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buyerSchema,
  updateBuyerSchema,
  uploadBulkBuyerSchema,
} from "../src/resources/buyers/validators/buyerValidator.ts";

const buyer = {
  fullName: "Asha Verma",
  phone: "9876543210",
  city: "Mohali",
  propertyType: "Apartment",
  purpose: "Buy",
  source: "Website",
};
const MESSAGE = "budgetMax must be greater than or equal to budgetMin";

test("rejects a maximum below the minimum, on budgetMax", () => {
  const result = buyerSchema.safeParse({ ...buyer, budgetMin: 5_000_000, budgetMax: 1_000_000 });
  assert.equal(result.success, false);
  const issue = result.error!.issues.find((i) => i.path.join(".") === "budgetMax");
  assert.equal(issue?.message, MESSAGE);
});

test("accepts equal or increasing budgets, and either one alone", () => {
  for (const budgets of [
    { budgetMin: 1_000_000, budgetMax: 1_000_000 },
    { budgetMin: 1_000_000, budgetMax: 2_000_000 },
    { budgetMin: 1_000_000 },
    { budgetMax: 2_000_000 },
    {},
  ]) {
    assert.equal(buyerSchema.safeParse({ ...buyer, ...budgets }).success, true, JSON.stringify(budgets));
  }
});

test("checks updates the same way", () => {
  assert.equal(updateBuyerSchema.safeParse({ budgetMin: 10, budgetMax: 5 }).success, false);
  assert.equal(updateBuyerSchema.safeParse({ budgetMin: 10 }).success, true);
  assert.equal(updateBuyerSchema.safeParse({ city: "Other" }).success, true);
});

test("rejects a bulk upload containing such a buyer", () => {
  assert.equal(
    uploadBulkBuyerSchema.safeParse([buyer, { ...buyer, budgetMin: 9, budgetMax: 3 }]).success,
    false,
  );
  assert.equal(uploadBulkBuyerSchema.safeParse([buyer]).success, true);
});
