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
      "eslint.config.js",
      "src/tools/descriptions/**",
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        tsconfigRootDir,
      },
    },
    plugins: {
      prettier: eslintPluginPrettier,
    },
    rules: {
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "no-control-regex": "off",
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
      "no-console": ["warn", { allow: ["warn", "error", "log"] }],
      "prefer-const": "error",
      "prettier/prettier": "error",
    },
  },
  eslintConfigPrettier,
);
