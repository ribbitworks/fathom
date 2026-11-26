// SPDX-License-Identifier: Apache-2.0

// Tests of running the tests 'pnpm test:changed' chooses: in the check's turn, side by side, with
// the cores shared among the packages, failing when any part fails.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { runTests } from "./test-changed.mjs";

describe("running the tests chosen", () => {
  const root = "/fictional/fathom";

  function recorder({ packagesPass = false } = {}) {
    const steps = [];
    return {
      steps,
      root,
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
        return packagesPass;
      },
    };
  }

  it("runs none, without waiting for a turn, when only documentation changed", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder();
    assert.equal(await runTests({ kind: "none" }, options), true);
    assert.deepEqual(steps, []);
  });

  it("runs the script tests, every test of some packages and the importing tests of others in the check's turn, measuring all the coverage of those running every test", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder({ packagesPass: true });
    assert.equal(
      await runTests(
        {
          kind: "packages",
          whole: ["apps/server", "packages/seed"],
          related: ["apps/web", "packages/shared"],
          files: ["packages/shared/src/views.ts", "apps/web/src/app.tsx"],
          covered: [],
        },
        options,
      ),
      true,
    );
    assert.deepEqual(steps, [
      "turn",
      "pnpm test:scripts 1",
      "pnpm typecheck 1",
      "packages --filter ./apps/server --filter ./packages/seed --parallel --no-bail exec vitest run --coverage --coverage.reporter=text --coverage.skipFull 1",
      "packages --filter ./apps/web --filter ./packages/shared --parallel --no-bail exec vitest related --run --passWithNoTests /fictional/fathom/packages/shared/src/views.ts /fictional/fathom/apps/web/src/app.tsx 1",
    ]);
  });

  it("checks the coverage of each package's changed source in a run of its own, and all of a package running every test", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder({ packagesPass: true });
    const tests = {
      kind: "packages",
      whole: ["apps/server", "packages/seed"],
      related: ["apps/web", "packages/shared"],
      files: ["apps/web/src/app.tsx", "packages/shared/src/views.ts"],
      covered: [
        "apps/server/src/people.ts",
        "apps/web/src/app.tsx",
        "apps/web/src/grid.tsx",
      ],
    };
    assert.equal(await runTests(tests, options), true);
    const related =
      "/fictional/fathom/apps/web/src/app.tsx /fictional/fathom/packages/shared/src/views.ts";
    assert.deepEqual(steps, [
      "turn",
      "pnpm test:scripts 1",
      "pnpm typecheck 1",
      "packages --filter ./apps/server --filter ./packages/seed --parallel --no-bail exec vitest run --coverage --coverage.reporter=text --coverage.skipFull 1",
      `packages --filter ./apps/web --parallel --no-bail exec vitest related --run --passWithNoTests --coverage --coverage.reporter=text --coverage.skipFull --coverage.include=src/app.tsx --coverage.include=src/grid.tsx ${related} 1`,
      `packages --filter ./packages/shared --parallel --no-bail exec vitest related --run --passWithNoTests ${related} 1`,
    ]);
    const failingCoverage = {
      ...options,
      runPackages: async (args) =>
        !args.includes("--coverage.include=src/app.tsx"),
    };
    assert.equal(await runTests(tests, failingCoverage), false);
  });

  it("runs only the script tests, checking no types, when no package has tests to run", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder();
    assert.equal(
      await runTests(
        { kind: "packages", whole: [], related: [], files: [], covered: [] },
        options,
      ),
      true,
    );
    assert.deepEqual(steps, ["turn", "pnpm test:scripts 1"]);
  });

  it("fails when either group of package tests fails", async (context) => {
    context.mock.method(console, "log", () => undefined);
    for (const failing of ["run", "related"]) {
      const options = {
        ...recorder(),
        runPackages: async (args) => !args.includes(failing),
      };
      assert.equal(
        await runTests(
          {
            kind: "packages",
            whole: ["apps/server"],
            related: ["apps/web"],
            files: ["apps/web/src/app.tsx"],
            covered: [],
          },
          options,
        ),
        false,
        failing,
      );
    }
  });

  it("fails when the types don't check, as GitHub's check would, running the tests all the same", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder({ packagesPass: true });
    const failingTypes = {
      ...options,
      run: async (args, environment) => {
        await options.run(args, environment);
        return args[0] !== "typecheck";
      },
    };
    assert.equal(
      await runTests(
        {
          kind: "packages",
          whole: [],
          related: ["apps/web"],
          files: ["apps/web/src/app.tsx"],
          covered: [],
        },
        failingTypes,
      ),
      false,
    );
    assert.deepEqual(steps, [
      "turn",
      "pnpm test:scripts 1",
      "pnpm typecheck 1",
      "packages --filter ./apps/web --parallel --no-bail exec vitest related --run --passWithNoTests /fictional/fathom/apps/web/src/app.tsx 1",
    ]);
  });

  it("leaves the types out when told another job checks them", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder({ packagesPass: true });
    assert.equal(
      await runTests(
        {
          kind: "packages",
          whole: ["apps/web"],
          related: [],
          files: [],
          covered: [],
        },
        { ...options, checkTypes: false },
      ),
      true,
    );
    assert.deepEqual(steps, [
      "turn",
      "pnpm test:scripts 1",
      "packages --filter ./apps/web --parallel --no-bail exec vitest run --coverage --coverage.reporter=text --coverage.skipFull 1",
    ]);
  });

  it("checks the types even when the script tests fail", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder({ packagesPass: true });
    const failingScripts = {
      ...options,
      run: async (args, environment) => {
        await options.run(args, environment);
        return args[0] !== "test:scripts";
      },
    };
    assert.equal(
      await runTests(
        {
          kind: "packages",
          whole: [],
          related: ["apps/web"],
          files: ["apps/web/src/app.tsx"],
          covered: [],
        },
        failingScripts,
      ),
      false,
    );
    assert.ok(steps.includes("pnpm typecheck 1"), steps.join("\n"));
  });

  it("fails when the script tests fail", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const options = {
      ...recorder({ packagesPass: true }),
      run: async () => false,
    };
    assert.equal(
      await runTests(
        {
          kind: "packages",
          whole: [],
          related: ["apps/web"],
          files: ["apps/web/src/app.tsx"],
          covered: [],
        },
        options,
      ),
      false,
    );
  });

  it("runs the script tests, the type check and both groups of package tests side by side", async (context) => {
    context.mock.method(console, "log", () => undefined);
    // Given four parts that each end only once all four have started
    const started = [];
    let release;
    const allStarted = new Promise((resolve) => {
      release = resolve;
    });
    const part = async (name) => {
      started.push(name);
      await allStarted;
      return true;
    };
    const options = {
      ...recorder(),
      run: async (args) => part(args[0]),
      runPackages: async (args) =>
        part(args.includes("related") ? "related" : "run"),
    };

    // When the tests run
    const finished = runTests(
      {
        kind: "packages",
        whole: ["apps/server"],
        related: ["apps/web"],
        files: ["apps/web/src/app.tsx"],
        covered: [],
      },
      options,
    );
    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    // Then all four have started before any has ended, and the run passes once they end
    assert.deepEqual(started, ["test:scripts", "typecheck", "run", "related"]);
    release();
    assert.equal(await finished, true);
  });

  it("shares the cores the script tests and type check leave among the packages it runs", async (context) => {
    context.mock.method(console, "log", () => undefined);
    // Given a computer of 18 cores
    const given = [];
    const options = {
      ...recorder(),
      cores: 18,
      runPackages: async (_args, { running, cores }) => {
        given.push({ running, cores });
        return true;
      },
    };

    // When a change runs every test of the server and the importing tests of the web app
    await runTests(
      {
        kind: "packages",
        whole: ["apps/server"],
        related: ["apps/web"],
        files: ["apps/web/src/app.tsx"],
        covered: [],
      },
      options,
    );

    // Then both groups share the 16 cores left among both packages
    const sharing = { running: ["apps/server", "apps/web"], cores: 16 };
    assert.deepEqual(given, [sharing, sharing]);
  });

  it("waits for every package run of a group before failing it for one that threw", async (context) => {
    context.mock.method(console, "log", () => undefined);
    context.mock.method(console, "error", () => undefined);
    // Given two runs of the importing tests, one throwing at once and one held until released
    let release;
    const held = new Promise((resolve) => {
      release = resolve;
    });
    const options = {
      ...recorder(),
      runPackages: async (args) => {
        if (args.includes("--coverage"))
          throw new Error("pnpm could not start");
        await held;
        return true;
      },
    };

    // When the tests run
    let settled = false;
    const finished = runTests(
      {
        kind: "packages",
        whole: [],
        related: ["apps/web", "packages/shared"],
        files: ["apps/web/src/app.tsx"],
        covered: ["apps/web/src/app.tsx"],
      },
      options,
    ).then((passed) => {
      settled = true;
      return passed;
    });
    await new Promise((resolve) => {
      setImmediate(resolve);
    });

    // Then the run waits for the held one, and fails once it ends
    assert.equal(settled, false);
    release();
    assert.equal(await finished, false);
  });

  it("names each part that failed, and why one that threw did", async (context) => {
    const said = context.mock.method(console, "log", () => undefined);
    const warned = context.mock.method(console, "error", () => undefined);
    // Given failing script tests and package tests that throw
    const options = {
      ...recorder(),
      run: async (args) => args[0] !== "test:scripts",
      runPackages: async () => {
        throw new Error("pnpm could not start");
      },
    };

    // When the tests run
    const passed = await runTests(
      {
        kind: "packages",
        whole: [],
        related: ["apps/web"],
        files: ["apps/web/src/app.tsx"],
        covered: [],
      },
      options,
    );

    // Then the run fails, naming both
    assert.equal(passed, false);
    assert.equal(
      said.mock.calls.at(-1)?.arguments[0],
      "==> Failed: Script tests; The importing tests of apps/web",
    );
    assert.equal(
      warned.mock.calls.at(0)?.arguments[0],
      "==> The importing tests of apps/web: pnpm could not start",
    );
  });

  it("runs the script tests and every package test in the check's turn when anything else changed", async (context) => {
    const said = context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder({ packagesPass: true });
    assert.equal(
      await runTests(
        {
          kind: "everything",
          whole: ["apps/server", "apps/web"],
          related: [],
          files: [],
          covered: [],
        },
        options,
      ),
      true,
    );
    assert.deepEqual(steps, [
      "turn",
      "pnpm test:scripts 1",
      "pnpm typecheck 1",
      "packages --filter ./apps/server --filter ./apps/web --parallel --no-bail exec vitest run --coverage --coverage.reporter=text --coverage.skipFull 1",
    ]);
    assert.equal(
      said.mock.calls[0]?.arguments[0],
      "==> Files outside the packages changed, so every test runs",
    );
  });
});
