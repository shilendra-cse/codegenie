import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

const LIBRARY = {
  group: ["**/factory", "**/factory/*", "@radix-ui/*", "radix-ui"],
  message:
    "Library components stay in components/factory; use them through our atoms.",
};

const DATA = [
  "@/features/*",
  "@/lib/api",
  "@/lib/api/*",
  "@/lib/query-client",
  "@/lib/auth-client",
  "@/app/*",
];

const ABOVE = {
  atoms: ["molecules", "organisms", "templates"],
  molecules: ["organisms", "templates"],
  organisms: ["templates"],
  templates: [],
};

const layerRules = [
  {
    files: ["**/*.{ts,tsx}"],
    ignores: ["components/atoms/**", "components/factory/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [LIBRARY] }],
    },
  },
  ...Object.entries(ABOVE).map(([layer, above]) => ({
    files: [`components/${layer}/**/*.{ts,tsx}`],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            ...(layer === "atoms" ? [] : [LIBRARY]),
            {
              group: [...above.map((name) => `**/${name}/*`), ...DATA],
              message: `Components in ${layer} take props and render: no data fetching, no imports from higher layers.`,
            },
          ],
        },
      ],
    },
  })),
];

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  ...layerRules,
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      ".next-e2e/**",
      "out/**",
      "build/**",
      "next-env.d.ts",
    ],
  },
];

export default eslintConfig;
