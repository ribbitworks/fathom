// SPDX-License-Identifier: Apache-2.0

// Tests of choosing the tests a change can affect, for 'pnpm test:changed': documentation alone
// runs none, a change in packages runs the script tests and those packages' tests, and any other
// change runs every test; any tests run in the check's turn, and none waits for it.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runTests, testsFor } from "./test-changed.mjs";

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

describe("running the tests chosen", () => {
  function recorder() {
    const steps = [];
    return {
      steps,
      inTurn: async (work) => {
        steps.push("turn");
        return work({ FATHOM_CHECK_SLOT: "1" });
      },
      run: async (args, environment) => {
        steps.push(`pnpm ${args.join(" ")} ${environment.FATHOM_CHECK_SLOT}`);
        return true;
      },
      runPackages: async (args, { environment }) => {
        steps.push(
          `packages ${args.join(" ")} ${environment.FATHOM_CHECK_SLOT}`,
        );
        return false;
      },
    };
  }

  it("runs none, without waiting for a turn, when only documentation changed", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder();
    assert.equal(await runTests({ kind: "none" }, options), true);
    assert.deepEqual(steps, []);
  });

  it("runs the script tests and the packages' tests in the check's turn, marked as in it, failing when either fails", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder();
    assert.equal(
      await runTests(
        { kind: "packages", packages: ["apps/server", "packages/shared"] },
        options,
      ),
      false,
    );
    assert.deepEqual(steps, [
      "turn",
      "pnpm test:scripts 1",
      "packages --filter ...{./apps/server} --filter ...{./packages/shared} --parallel --no-bail --if-present test 1",
    ]);
  });

  it("runs every test in the check's turn", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder();
    assert.equal(await runTests({ kind: "everything" }, options), true);
    assert.deepEqual(steps, ["turn", "pnpm test 1"]);
  });
});
