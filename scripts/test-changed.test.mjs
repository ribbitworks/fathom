// SPDX-License-Identifier: Apache-2.0

// Tests of 'pnpm test:changed': choosing the tests a change can affect, and checking the coverage of
// the source files it changed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
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

// Every file exists, as either kind of TypeScript in the web app, and as plain TypeScript elsewhere.
const allExist = (path) =>
  path.startsWith("apps/web/") || !path.endsWith(".tsx");
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

  it("runs the tests importing a package's source, in it and in every package depending on it, checking the changed source's coverage", () => {
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
          "apps/server/src/people.ts",
          "packages/shared/src/views.ts",
        ],
        covered: ["apps/server/src/people.ts", "packages/shared/src/views.ts"],
      },
    );
  });

  it("runs only the web app's tests importing a change to its components", () => {
    assert.deepEqual(choose(["apps/web/src/app.tsx"]), {
      kind: "packages",
      whole: [],
      related: ["apps/web"],
      files: ["apps/web/src/app.tsx"],
      covered: ["apps/web/src/app.tsx"],
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
        covered: [],
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
        covered: [],
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
          covered: ["apps/web/src/app.tsx"],
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
        covered: ["packages/shared/src/views.ts"],
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
        covered: ["apps/server/src/people.ts"],
      },
    );
    assert.deepEqual(
      choose(["apps/server/src/removed.ts"], () => false),
      {
        kind: "packages",
        whole: [],
        related: [],
        files: [],
        covered: [],
      },
    );
  });

  it("runs the tests of the packages depending on one without tests of its own", () => {
    assert.deepEqual(choose(["packages/test-utils/package.json"]), {
      kind: "packages",
      whole: ["apps/server", "packages/seed"],
      related: [],
      files: [],
      covered: [],
    });
  });

  it("runs every web app test, with its coverage, when only its stylesheets changed, with any documentation", () => {
    assert.deepEqual(
      choose([
        "apps/web/src/record-grid.module.css",
        "apps/web/src/theme.css",
        "docs/design/visual-design.md",
      ]),
      {
        kind: "packages",
        whole: ["apps/web"],
        related: [],
        files: [],
        covered: [],
      },
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
        covered: ["apps/web/src/app.tsx"],
      },
    );
  });

  it("runs every test of every package with tests when a file outside the packages changed", () => {
    for (const path of [
      "styles/theme.css",
      "pnpm-lock.yaml",
      "package.json",
      "scripts/lib.sh",
      "scripts/test-ui.sh",
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
          covered: ["apps/web/src/app.tsx"],
        },
        path,
      );
    }
  });

  it("runs only the script tests when only the scripts' modules, the container tests or .github changed", () => {
    assert.deepEqual(
      choose([
        "scripts/changed-paths.mjs",
        "scripts/check-turn.test.mjs",
        "scripts/container-tests/containers.test.mjs",
        ".github/workflows/check.yml",
        "docs/design/checks-and-ci.md",
      ]),
      { kind: "packages", whole: [], related: [], files: [], covered: [] },
    );
  });

  it("runs every test of every package when a script that starts the package tests changed", () => {
    for (const path of [
      "scripts/check-turn.mjs",
      "scripts/package-tests.mjs",
      "scripts/run-command.mjs",
      "scripts/test-changed.mjs",
      "scripts/workspace.mjs",
    ])
      assert.equal(choose([path]).kind, "everything", path);
  });

  it("runs the package tests a change can affect beside the scripts' modules, and no more", () => {
    assert.deepEqual(
      choose(["scripts/changed-paths.mjs", "apps/web/src/app.tsx"]),
      choose(["apps/web/src/app.tsx"]),
    );
  });

  it("checks the coverage of the source beside a changed or removed test, running every test importing it", () => {
    assert.deepEqual(
      choose(
        ["apps/web/src/grid.test.tsx", "apps/server/src/people.test.ts"],
        (path) =>
          path !== "apps/server/src/people.test.ts" &&
          path !== "apps/web/src/grid.ts" &&
          allExist(path),
      ),
      {
        kind: "packages",
        whole: [],
        related: ["apps/server", "apps/web", "packages/seed"],
        files: [
          "apps/server/src/people.ts",
          "apps/web/src/grid.test.tsx",
          "apps/web/src/grid.tsx",
        ],
        covered: ["apps/server/src/people.ts", "apps/web/src/grid.tsx"],
      },
    );
  });

  it("checks the coverage of no file outside a package's source, nor in a package without tests", () => {
    assert.deepEqual(
      choose([
        "apps/server/scripts/tool.ts",
        "packages/test-utils/src/users.ts",
        "apps/server/src/fixture.json",
      ]).covered,
      [],
    );
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
      tests: {
        kind: "packages",
        whole: [],
        related: ["apps/web"],
        files: ["apps/web/src/app.tsx"],
        covered: ["apps/web/src/app.tsx"],
      },
      checkTypes: true,
    });
    assert.deepEqual(calls, [{ uncommitted: false }]);
  });

  it("counts only the work not yet committed with --uncommitted", () => {
    const { calls, listChanged } = lister(["apps/web/src/theme.css"]);
    assert.deepEqual(
      testsForArguments(["--uncommitted"], listChanged, chooser),
      {
        tests: {
          kind: "packages",
          whole: ["apps/web"],
          related: [],
          files: [],
          covered: [],
        },
        checkTypes: true,
      },
    );
    assert.deepEqual(calls, [{ uncommitted: true }]);
  });

  it("leaves the types to another job with --without-types", () => {
    const { listChanged } = lister(["apps/web/src/app.tsx"]);
    assert.equal(
      testsForArguments(["--without-types"], listChanged, chooser).checkTypes,
      false,
    );
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

describe("checking a changed file's coverage with Vitest", () => {
  const vitest = fileURLToPath(
    new URL("../packages/shared/node_modules/.bin/vitest", import.meta.url),
  );
  const thresholds = {
    branches: 100,
    functions: 100,
    lines: 100,
    statements: 100,
  };
  const settings = `export default ${JSON.stringify({
    test: {
      include: ["src/**/*.test.ts"],
      coverage: {
        provider: "v8",
        include: ["src/**/*.ts"],
        exclude: ["src/**/*.test.ts"],
        thresholds,
      },
    },
  })};\n`;
  const source =
    'export const sign = (x: number) => (x > 0 ? "up" : "down");\n';
  const caseFor = (value, expected) =>
    `it("${expected}", () => { expect(sign(${String(value)})).toBe("${expected}"); });\n`;

  // Runs the tests chosen for a change to src/sign.ts in a package of its own, with these cases in
  // its test, beside a file no test reaches that the change leaves alone, and gives back whether
  // they passed and what Vitest said.
  async function checkChange(cases) {
    assert.ok(existsSync(vitest), `${vitest} is missing; run pnpm install`);
    const root = realpathSync(mkdtempSync(join(tmpdir(), "fathom-coverage-")));
    const folder = join(root, "fixture");
    let said = "";
    try {
      mkdirSync(join(folder, "src"), { recursive: true });
      writeFileSync(join(folder, "vitest.config.mjs"), settings);
      writeFileSync(join(folder, "src", "sign.ts"), source);
      writeFileSync(
        join(folder, "src", "sign.test.ts"),
        `import { expect, it } from "vitest";\nimport { sign } from "./sign";\n${cases.join("")}`,
      );
      writeFileSync(join(folder, "src", "untouched.ts"), source);
      const passed = await runTests(
        {
          kind: "packages",
          whole: [],
          related: ["fixture"],
          files: ["fixture/src/sign.ts"],
          covered: ["fixture/src/sign.ts"],
        },
        {
          root,
          inTurn: (work) => work(process.env),
          run: async () => true,
          runPackages: async (args) => {
            const ran = spawnSync(
              vitest,
              args.slice(args.indexOf("vitest") + 1),
              { cwd: folder, encoding: "utf8" },
            );
            said = `${ran.stdout}${ran.stderr}`;
            return ran.status === 0;
          },
        },
      );
      return { passed, said };
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it("fails a changed file with a branch its passing tests never reach", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { passed, said } = await checkChange([caseFor(1, "up")]);
    assert.equal(passed, false);
    assert.match(said, /1 passed/);
    assert.match(said, /Coverage for branches \(50%\) does not meet/);
  });

  it("passes a changed file its tests fully cover, beside one no test reaches", async (context) => {
    context.mock.method(console, "log", () => undefined);
    const { passed, said } = await checkChange([
      caseFor(1, "up"),
      caseFor(0, "down"),
    ]);
    assert.equal(passed, true, said);
    assert.doesNotMatch(said, /untouched/);
  });
});
