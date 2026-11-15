// SPDX-License-Identifier: Apache-2.0

// Tests of choosing the tests a change can affect, for 'pnpm test:changed': documentation alone
// runs none, the web app's stylesheets alone run its tests and the linters, a change in packages
// runs the script tests and those packages' tests, and any other change runs every test; any tests
// run in the check's turn, and none waits for it.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runTests, testsFor, testsForArguments } from "./test-changed.mjs";

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

  it("runs the web app's tests and the linters when only its stylesheets changed, with any documentation", () => {
    assert.deepEqual(
      testsFor([
        "apps/web/src/record-grid.module.css",
        "apps/web/src/theme.css",
        "docs/design/visual-design.md",
      ]),
      { kind: "stylesheets" },
    );
  });

  it("runs the packages' tests when a stylesheet changed with other code", () => {
    assert.deepEqual(
      testsFor(["apps/web/src/theme.css", "apps/web/src/app.tsx"]),
      { kind: "packages", packages: ["apps/web"] },
    );
  });

  it("runs every test when a stylesheet outside the web app changed", () => {
    assert.deepEqual(testsFor(["styles/theme.css"]), {
      kind: "everything",
    });
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

describe("the command's arguments", () => {
  function lister(paths) {
    const calls = [];
    return {
      calls,
      listChanged: (options) => {
        calls.push(options);
        return paths;
      },
    };
  }

  it("counts everything since the branch left main by default", () => {
    const { calls, listChanged } = lister(["apps/server/src/people.ts"]);
    assert.deepEqual(testsForArguments([], listChanged), {
      kind: "packages",
      packages: ["apps/server"],
    });
    assert.deepEqual(calls, [{ uncommitted: false }]);
  });

  it("counts only the work not yet committed with --uncommitted", () => {
    const { calls, listChanged } = lister(["apps/web/src/theme.css"]);
    assert.deepEqual(testsForArguments(["--uncommitted"], listChanged), {
      kind: "stylesheets",
    });
    assert.deepEqual(calls, [{ uncommitted: true }]);
  });

  it("refuses an unknown argument", () => {
    const { calls, listChanged } = lister([]);
    assert.throws(
      () => testsForArguments(["--everything"], listChanged),
      /Unknown option '--everything'/,
    );
    assert.deepEqual(calls, []);
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

  it("runs the linters and the web app's tests in the check's turn, failing when any fails", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder();
    assert.equal(await runTests({ kind: "stylesheets" }, options), false);
    assert.deepEqual(steps, [
      "turn",
      "pnpm lint 1",
      "pnpm format:check 1",
      "packages --filter ./apps/web --if-present test 1",
    ]);
  });

  it("fails the stylesheets' run when any one of its steps alone fails", async (context) => {
    context.mock.method(console, "log", () => undefined);
    for (const failing of ["lint", "format:check", "web"]) {
      const options = {
        inTurn: recorder().inTurn,
        run: async (args) => args[0] !== failing,
        runPackages: async () => failing !== "web",
      };
      assert.equal(
        await runTests({ kind: "stylesheets" }, options),
        false,
        failing,
      );
    }
  });

  it("runs every test in the check's turn", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder();
    assert.equal(await runTests({ kind: "everything" }, options), true);
    assert.deepEqual(steps, ["turn", "pnpm test 1"]);
  });
});
