import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import eslintConfigPrettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  // Global ignores
  {
    ignores: ["**/dist/", "**/public/", "**/node_modules/", "apps/cli/bin/", "**/coverage/"],
  },

  // Base: ESLint recommended + TS recommended
  eslint.configs.recommended,
  ...tseslint.configs.recommended,

  // Backend + shared: Node globals, warn on console
  {
    files: ["apps/cli/src/**/*.ts", "packages/shared/src/**/*.ts"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "no-console": "warn",
    },
  },

  // CLI commands + banner: allow console (legitimate CLI output)
  {
    files: ["apps/cli/src/commands/**/*.ts", "apps/cli/src/lib/banner.ts", "apps/cli/src/main.ts"],
    rules: {
      "no-console": "off",
    },
  },

  // Frontend: browser globals, React plugins
  {
    files: ["apps/cli/web/**/*.{ts,tsx}"],
    languageOptions: {
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
    },
  },

  // Test files: vitest globals
  {
    files: ["**/__tests__/**/*.ts", "**/*.test.ts", "**/*.spec.ts"],
    languageOptions: {
      globals: globals.node,
    },
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },

  // Global rule overrides
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },

  // Prettier compat (must be last)
  eslintConfigPrettier,
);
