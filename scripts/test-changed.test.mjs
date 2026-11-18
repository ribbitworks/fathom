// SPDX-License-Identifier: Apache-2.0

// Tests of choosing the tests a change can affect, for 'pnpm test:changed': documentation alone
// runs none, a package's source runs the tests importing it in that package and those depending on
// it, any other change in a package runs every test of those packages, a Help page runs the web
// app's tests importing the Help pages, the web app's stylesheets alone run its tests and the
// linters, and any other change runs every test, all without coverage; any tests run in the check's
// turn, and none waits for it.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  readWorkspace,
  runTests,
  testsFor,
  testsForArguments,
} from "./test-changed.mjs";

// A workspace shaped as Fathom's: the seed depends on the server, which depends on the shared
// package, as the web app does; the test helpers have no tests of their own.
const workspace = new Map(
  Object.entries({
    "apps/server": {
      dependsOn: ["packages/shared", "packages/test-utils"],
      hasTests: true,
    },
    "apps/web": { dependsOn: ["packages/shared"], hasTests: true },
    "packages/seed": { dependsOn: ["apps/server"], hasTests: true },
    "packages/shared": { dependsOn: [], hasTests: true },
    "packages/test-utils": { dependsOn: [], hasTests: false },
  }),
);

const allExist = () => true;
const choose = (paths, exists = allExist) =>
  testsFor(paths, { workspace, exists });

describe("choosing the tests a change can affect", () => {
  it("runs none when only documentation changed", () => {
    assert.deepEqual(
      choose(["docs/issues.md", "README.md", "apps/web/README.md"]),
      { kind: "none" },
    );
  });

  it("runs none when nothing changed", () => {
    assert.deepEqual(choose([]), { kind: "none" });
  });

  it("runs the tests importing a package's source, in it and in every package depending on it", () => {
    assert.deepEqual(
      choose([
        "packages/shared/src/views.ts",
        "apps/server/src/people.test.ts",
        "packages/shared/src/views.ts",
        "docs/issues.md",
      ]),
      {
        kind: "packages",
        whole: [],
        related: [
          "apps/server",
          "apps/web",
          "packages/seed",
          "packages/shared",
        ],
        files: [
          "apps/server/src/people.test.ts",
          "packages/shared/src/views.ts",
        ],
      },
    );
  });

  it("runs only the web app's tests importing a change to its components", () => {
    assert.deepEqual(choose(["apps/web/src/app.tsx"]), {
      kind: "packages",
      whole: [],
      related: ["apps/web"],
      files: ["apps/web/src/app.tsx"],
    });
  });

  it("runs the web app's tests importing the Help pages when one changed, since it builds them in", () => {
    assert.deepEqual(
      choose(["docs/help/lists.md", "docs/help/people.md", "docs/issues.md"]),
      {
        kind: "packages",
        whole: [],
        related: ["apps/web"],
        files: ["apps/web/src/help-pages.ts"],
      },
    );
  });

  it("runs the web app's tests importing the Help pages when one was removed", () => {
    assert.deepEqual(
      choose(
        ["docs/help/retired.md"],
        (path) => path !== "docs/help/retired.md",
      ),
      {
        kind: "packages",
        whole: [],
        related: ["apps/web"],
        files: ["apps/web/src/help-pages.ts"],
      },
    );
  });

  it("runs every test of a package, and of those depending on it, when more than its source changed", () => {
    for (const path of [
      "apps/server/package.json",
      "apps/server/vitest.config.ts",
      "apps/server/migrations/0001_fictional.sql",
      "apps/server/src/fixture.json",
    ]) {
      assert.deepEqual(
        choose([path, "apps/web/src/app.tsx"]),
        {
          kind: "packages",
          whole: ["apps/server", "packages/seed"],
          related: ["apps/web"],
          files: ["apps/web/src/app.tsx"],
        },
        path,
      );
    }
  });

  it("runs the tests importing a source file only in packages not already running every test", () => {
    assert.deepEqual(
      choose(["apps/server/package.json", "packages/shared/src/views.ts"]),
      {
        kind: "packages",
        whole: ["apps/server", "packages/seed"],
        related: ["apps/web", "packages/shared"],
        files: ["packages/shared/src/views.ts"],
      },
    );
  });

  it("runs nothing of a removed source file, whose importers changed too", () => {
    assert.deepEqual(
      choose(
        ["apps/server/src/removed.ts", "apps/server/src/people.ts"],
        (path) => path !== "apps/server/src/removed.ts",
      ),
      {
        kind: "packages",
        whole: [],
        related: ["apps/server", "packages/seed"],
        files: ["apps/server/src/people.ts"],
      },
    );
    assert.deepEqual(
      choose(["apps/server/src/removed.ts"], () => false),
      {
        kind: "packages",
        whole: [],
        related: [],
        files: [],
      },
    );
  });

  it("runs the tests of the packages depending on one without tests of its own", () => {
    assert.deepEqual(choose(["packages/test-utils/package.json"]), {
      kind: "packages",
      whole: ["apps/server", "packages/seed"],
      related: [],
      files: [],
    });
  });

  it("runs the web app's tests and the linters when only its stylesheets changed, with any documentation", () => {
    assert.deepEqual(
      choose([
        "apps/web/src/record-grid.module.css",
        "apps/web/src/theme.css",
        "docs/design/visual-design.md",
      ]),
      { kind: "stylesheets" },
    );
  });

  it("runs every web app test when a stylesheet changed with other code", () => {
    assert.deepEqual(
      choose(["apps/web/src/theme.css", "apps/web/src/app.tsx"]),
      {
        kind: "packages",
        whole: ["apps/web"],
        related: [],
        files: ["apps/web/src/app.tsx"],
      },
    );
  });

  it("runs every test of every package with tests when a file outside the packages changed", () => {
    for (const path of [
      "styles/theme.css",
      "pnpm-lock.yaml",
      "package.json",
      "scripts/lib.sh",
      "deploy/compose.dev.yaml",
      "tsconfig.base.json",
    ]) {
      assert.deepEqual(
        choose(["apps/web/src/app.tsx", path]),
        {
          kind: "everything",
          whole: [
            "apps/server",
            "apps/web",
            "packages/seed",
            "packages/shared",
          ],
          related: [],
          files: [],
        },
        path,
      );
    }
  });
});

describe("reading the workspace", () => {
  it("names each package's dependencies within it by folder, and whether it has tests", () => {
    const manifests = [
      {
        folder: "apps/server",
        manifest: {
          name: "@fictional/server",
          scripts: { test: "vitest run" },
          dependencies: { "@fictional/shared": "workspace:*", zod: "4.0.0" },
          devDependencies: { "@fictional/helpers": "workspace:*" },
        },
      },
      {
        folder: "packages/shared",
        manifest: {
          name: "@fictional/shared",
          scripts: { test: "vitest run" },
        },
      },
      { folder: "packages/helpers", manifest: { name: "@fictional/helpers" } },
    ];
    assert.deepEqual(
      readWorkspace(manifests),
      new Map([
        [
          "apps/server",
          {
            dependsOn: ["packages/shared", "packages/helpers"],
            hasTests: true,
          },
        ],
        ["packages/shared", { dependsOn: [], hasTests: true }],
        ["packages/helpers", { dependsOn: [], hasTests: false }],
      ]),
    );
  });

  it("reads this repository's packages", () => {
    const read = readWorkspace();
    assert.deepEqual(read.get("apps/web"), {
      dependsOn: ["packages/shared"],
      hasTests: true,
    });
    assert.equal(read.get("packages/test-utils")?.hasTests, false);
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

  const chooser = (paths) => choose(paths);

  it("counts everything since the branch left main by default", () => {
    const { calls, listChanged } = lister(["apps/web/src/app.tsx"]);
    assert.deepEqual(testsForArguments([], listChanged, chooser), {
      kind: "packages",
      whole: [],
      related: ["apps/web"],
      files: ["apps/web/src/app.tsx"],
    });
    assert.deepEqual(calls, [{ uncommitted: false }]);
  });

  it("counts only the work not yet committed with --uncommitted", () => {
    const { calls, listChanged } = lister(["apps/web/src/theme.css"]);
    assert.deepEqual(
      testsForArguments(["--uncommitted"], listChanged, chooser),
      { kind: "stylesheets" },
    );
    assert.deepEqual(calls, [{ uncommitted: true }]);
  });

  it("refuses an unknown argument", () => {
    const { calls, listChanged } = lister([]);
    assert.throws(
      () => testsForArguments(["--everything"], listChanged, chooser),
      /Unknown option '--everything'/,
    );
    assert.deepEqual(calls, []);
  });
});

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

  it("runs the script tests, every test of some packages and the importing tests of others in the check's turn, without coverage", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder({ packagesPass: true });
    assert.equal(
      await runTests(
        {
          kind: "packages",
          whole: ["apps/server", "packages/seed"],
          related: ["apps/web", "packages/shared"],
          files: ["packages/shared/src/views.ts", "apps/web/src/app.tsx"],
        },
        options,
      ),
      true,
    );
    assert.deepEqual(steps, [
      "turn",
      "pnpm test:scripts 1",
      "packages --filter ./apps/server --filter ./packages/seed --parallel --no-bail exec vitest run 1",
      "packages --filter ./apps/web --filter ./packages/shared --parallel --no-bail exec vitest related --run --passWithNoTests /fictional/fathom/packages/shared/src/views.ts /fictional/fathom/apps/web/src/app.tsx 1",
    ]);
  });

  it("runs only the script tests when no package has tests to run", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder();
    assert.equal(
      await runTests(
        { kind: "packages", whole: [], related: [], files: [] },
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
          },
          options,
        ),
        false,
        failing,
      );
    }
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
        },
        options,
      ),
      false,
    );
  });

  it("runs the linters and every web app test in the check's turn, failing when any fails", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { steps, ...options } = recorder();
    assert.equal(await runTests({ kind: "stylesheets" }, options), false);
    assert.deepEqual(steps, [
      "turn",
      "pnpm lint 1",
      "pnpm format:check 1",
      "packages --filter ./apps/web exec vitest run 1",
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
        },
        options,
      ),
      true,
    );
    assert.deepEqual(steps, [
      "turn",
      "pnpm test:scripts 1",
      "packages --filter ./apps/server --filter ./apps/web --parallel --no-bail exec vitest run 1",
    ]);
    assert.equal(
      said.mock.calls[0]?.arguments[0],
      "==> Files outside the packages changed, so every test runs",
    );
  });
});
