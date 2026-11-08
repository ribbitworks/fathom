// SPDX-License-Identifier: Apache-2.0

// Tests of choosing the tests a change can affect, for 'pnpm test:changed': documentation alone
// runs none, a change in packages runs the script tests and those packages' tests, and any other
// change runs every test.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { testsFor } from "./test-changed.mjs";

describe("choosing the tests a change can affect", () => {
  it("runs none when only documentation changed", () => {
    assert.deepEqual(
      testsFor(["docs/issues.md", "README.md", "apps/web/README.md"]),
      { kind: "none" },
    );
  });

  it("runs none when nothing changed", () => {
    assert.deepEqual(testsFor([]), { kind: "none" });
  });

  it("runs the script tests and each changed package's tests, once each", () => {
    assert.deepEqual(
      testsFor([
        "apps/server/src/people.ts",
        "packages/shared/src/access.ts",
        "apps/server/src/people.test.ts",
        "docs/issues.md",
      ]),
      { kind: "packages", packages: ["apps/server", "packages/shared"] },
    );
  });

  it("runs every test when a file outside the packages changed", () => {
    for (const path of [
      "pnpm-lock.yaml",
      "package.json",
      "scripts/lib.sh",
      "deploy/compose.dev.yaml",
      "tsconfig.base.json",
    ]) {
      assert.deepEqual(
        testsFor(["apps/web/src/app.tsx", path]),
        { kind: "everything" },
        path,
      );
    }
  });
});
