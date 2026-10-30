// SPDX-License-Identifier: Apache-2.0

// ESLint settings for all JavaScript and TypeScript in the repository: strict type-aware rules for
// TypeScript, security rules for all of it, browser globals and React's rules of hooks for the front
// end, and the boundary of the server's data access layer, skipping the files git ignores.

import { includeIgnoreFile } from "@eslint/compat";
import js from "@eslint/js";
import { defineConfig } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import security from "eslint-plugin-security";
import globals from "globals";
import { fileURLToPath } from "node:url";
import tseslint from "typescript-eslint";

const gitignorePath = fileURLToPath(new URL(".gitignore", import.meta.url));

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  tseslint.configs.strictTypeChecked,
  security.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },
  {
    ignores: ["apps/web/src/**"],
    languageOptions: { globals: globals.node },
  },
  {
    // The front end runs in the browser, so Node.js globals such as process are not available.
    files: ["apps/web/src/**"],
    extends: [reactHooks.configs.flat.recommended],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ["**/*.js", "**/*.mjs"],
    extends: [tseslint.configs.disableTypeChecked],
  },
  {
    // Scripts and tests read and write files in folders they create themselves, not paths from users.
    files: ["scripts/**", "**/*.test.ts", "packages/test-utils/**"],
    rules: { "security/detect-non-literal-fs-filename": "off" },
  },
  {
    // Only the server's data access layer queries the database, so every read of protected data
    // goes through it. Other code may use the database package's types, and the server's start-up
    // code and the account command read the database settings and create the connection pool. The
    // query libraries are restricted too, so a raw query cannot be written elsewhere.
    files: ["**/*.ts", "**/*.tsx"],
    ignores: [
      "packages/db/**",
      "packages/test-utils/**",
      "apps/server/src/data/**",
      "apps/server/src/config.ts",
      "apps/server/src/server.ts",
      "apps/server/src/create-account.ts",
      "**/*.test.ts",
    ],
    rules: {
      "@typescript-eslint/no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "@fathom/db",
              message:
                "Only the server's data access layer, in apps/server/src/data/, may query the database.",
              allowTypeImports: true,
            },
            {
              name: "pg",
              message:
                "Only the server's data access layer may query the database.",
              allowTypeImports: true,
            },
          ],
          patterns: [
            {
              group: ["drizzle-orm", "drizzle-orm/*"],
              message:
                "Only the server's data access layer may query the database.",
              allowTypeImports: true,
            },
          ],
        },
      ],
    },
  },
);
