// For apps that use @hobai/db: every query goes through the query layer (src/queries), never built in the app.
const message =
  "Queries live in @hobai/db (packages/db/src/queries): call a query function instead.";

const DB = "/^(db|tx)$/";
const QUERY_CALLS = "/^(insert|select|update|delete|execute|transaction)$/";

export const queryLayerRules = {
  files: ["src/**/*.ts"],
  ignores: ["src/**/*.test.ts"],
  rules: {
    "no-restricted-imports": [
      "error",
      { patterns: [{ group: ["drizzle-orm", "drizzle-orm/*"], message }] },
    ],
    "no-restricted-syntax": [
      "error",
      {
        selector: `CallExpression[callee.object.name=${DB}][callee.property.name=${QUERY_CALLS}]`,
        message,
      },
      {
        selector: `CallExpression[callee.object.property.name=${DB}][callee.property.name=${QUERY_CALLS}]`,
        message,
      },
      {
        selector: `MemberExpression[object.name=${DB}][property.name='query']`,
        message,
      },
      {
        selector: `MemberExpression[object.property.name=${DB}][property.name='query']`,
        message,
      },
    ],
  },
};
