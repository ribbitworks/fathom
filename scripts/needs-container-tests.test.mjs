// SPDX-License-Identifier: Apache-2.0

// Tests of deciding whether a pull request needs the container tests: documentation alone doesn't,
// anything else, Help pages included, does, and a base git can't compare against is an error.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  needsContainerTests,
  pathsChangedSince,
} from "./needs-container-tests.mjs";

describe("whether a change needs the container tests", () => {
  it("doesn't when only documentation changed", () => {
    assert.equal(
      needsContainerTests(["docs/standards/testing.md", "README.md"]),
      false,
    );
  });

  it("does when code, settings, scripts or a Help page changed", () => {
    for (const path of [
      "apps/server/src/app.ts",
      "deploy/compose.yaml",
      "pnpm-lock.yaml",
      "scripts/lib.sh",
      ".github/workflows/check.yml",
      "docs/help/lists.md",
    ]) {
      assert.equal(needsContainerTests(["README.md", path]), true, path);
    }
  });

  it("doesn't when nothing changed", () => {
    assert.equal(needsContainerTests([]), false);
  });
});

describe("the paths a pull request changed", () => {
  it("lists the paths git names since the base, leaving out blank lines", () => {
    const calls = [];
    const run = (command, args) => {
      calls.push([command, ...args]);
      return { status: 0, stdout: "apps/web/src/app.tsx\nREADME.md\n" };
    };
    assert.deepEqual(pathsChangedSince("abc123", run), [
      "apps/web/src/app.tsx",
      "README.md",
    ]);
    assert.deepEqual(calls, [["git", "diff", "--name-only", "abc123...HEAD"]]);
  });

  it("fails, naming the base, when git can't compare against it", () => {
    const run = () => ({ status: 128, stdout: "", stderr: "bad revision\n" });
    assert.throws(
      () => pathsChangedSince("abc123", run),
      /git diff against abc123 failed: bad revision/,
    );
  });
});
