import { queryLayerRules } from "@hobai/db/eslint";
import eslint from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import eslintPluginPrettier from "eslint-plugin-prettier";
import tseslint from "typescript-eslint";

const tsconfigRootDir = import.meta.dirname;

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "drizzle.config.ts",
      "eslint.config.js",
      "vitest.config.ts",
      "tsup.config.ts",
    ],
  },
  eslint.configs.recommended,
  {
    files: ["**/*.ts"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        project: "./tsconfig.json",
        tsconfigRootDir,
      },
    },
  },
  {
    files: ["**/*.ts"],
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-non-null-assertion": "warn",
      "no-console": ["warn", { allow: ["warn", "error"] }],
      "prefer-const": "error",
      "no-var": "error",
      eqeqeq: ["error", "always"],
      "no-duplicate-imports": "error",
      "sort-imports": [
        "error",
        {
          ignoreCase: true,
          ignoreDeclarationSort: true,
        },
      ],
      "prettier/prettier": "error",
    },
  },
  {
    // A wrong `!` in a test just fails that test.
    files: ["**/*.test.ts"],
    rules: {
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["**/*.js"],
    ...tseslint.configs.disableTypeChecked,
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
    },
  },
  queryLayerRules,
  eslintConfigPrettier,
);
