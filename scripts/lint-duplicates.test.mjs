// SPDX-License-Identifier: Apache-2.0

// Tests of the duplicate-code check: it fails only where a change makes two files repeat more of
// each other than at origin/main, following renames, and passes over older copies and edits in them.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import {
  copiesIn,
  duplicatesVerdict,
  lintDuplicates,
  renamesIn,
} from "./lint-duplicates.mjs";

function copy(first, second, tokens = 120, lines = 12) {
  return {
    tokens,
    lines,
    places: [first, second].map(([path, start, end]) => ({ path, start, end })),
  };
}

const older = copy(["apps/web/src/a.ts", 1, 20], ["apps/web/src/b.ts", 5, 24]);

describe("the duplicate-code check's verdict", () => {
  it("passes when the change copies nothing, counting the copies already there", () => {
    assert.deepEqual(
      duplicatesVerdict({
        copies: [older],
        baseCopies: [older],
        renamed: new Map(),
      }),
      {
        passed: true,
        lines: [
          "No code copied by this change; 1 older copy is left for a later change to share",
        ],
      },
    );
  });

  it("passes when an edit inside an older copy shrinks it", () => {
    const shrunk = copy(
      ["apps/web/src/a.ts", 1, 12],
      ["apps/web/src/b.ts", 5, 16],
      100,
      8,
    );
    assert.equal(
      duplicatesVerdict({
        copies: [shrunk],
        baseCopies: [older],
        renamed: new Map(),
      }).passed,
      true,
    );
  });

  it("passes when a file holding an older copy is renamed", () => {
    const moved = copy(
      ["apps/web/src/a.ts", 1, 20],
      ["apps/web/src/moved.ts", 5, 24],
    );
    assert.equal(
      duplicatesVerdict({
        copies: [moved],
        baseCopies: [older],
        renamed: new Map([["apps/web/src/b.ts", "apps/web/src/moved.ts"]]),
      }).passed,
      true,
    );
  });

  it("fails on a copy between two files that repeated nothing, naming both places", () => {
    const added = copy(
      ["apps/server/src/data/history.ts", 7, 160],
      ["packages/shared/src/history.ts", 3, 156],
      922,
      154,
    );
    assert.deepEqual(
      duplicatesVerdict({
        copies: [older, added],
        baseCopies: [older],
        renamed: new Map(),
      }),
      {
        passed: false,
        lines: [
          "This change copies code between two files; share it instead:",
          "  apps/server/src/data/history.ts:7-160 and packages/shared/src/history.ts:3-156 (154 lines)",
        ],
      },
    );
  });

  it("fails when two files that repeated some code repeat more", () => {
    const another = copy(
      ["apps/web/src/a.ts", 40, 60],
      ["apps/web/src/b.ts", 50, 70],
    );
    const verdict = duplicatesVerdict({
      copies: [older, another],
      baseCopies: [older],
      renamed: new Map(),
    });
    assert.equal(verdict.passed, false);
    assert.equal(verdict.lines.length, 3);
  });

  it("counts the pairs of files a change copies between", () => {
    const verdict = duplicatesVerdict({
      copies: [
        copy(["a.ts", 1, 12], ["b.ts", 1, 12]),
        copy(["c.ts", 1, 12], ["d.ts", 1, 12]),
      ],
      baseCopies: [],
      renamed: new Map(),
    });
    assert.equal(
      verdict.lines[0],
      "This change copies code between 2 pairs of files; share each instead:",
    );
  });

  it("says how many older copies are left, or that there are none", () => {
    const another = copy(["c.ts", 1, 12], ["d.ts", 1, 12]);
    assert.deepEqual(
      duplicatesVerdict({
        copies: [older, another],
        baseCopies: [older, another],
        renamed: new Map(),
      }).lines,
      [
        "No code copied by this change; 2 older copies are left for later changes to share",
      ],
    );
    assert.deepEqual(
      duplicatesVerdict({ copies: [], baseCopies: [], renamed: new Map() })
        .lines,
      ["No code copied by this change, and no older copies"],
    );
  });
});

describe("reading jscpd's report and git's renames", () => {
  it("names each copy's places from the scanned folder", () => {
    assert.deepEqual(
      copiesIn(
        {
          duplicates: [
            {
              tokens: 120,
              lines: 12,
              firstFile: { name: "/work/fathom/a.ts", start: 1, end: 12 },
              secondFile: { name: "/work/fathom/src/b.ts", start: 3, end: 14 },
            },
          ],
        },
        "/work/fathom",
      ),
      [copy(["a.ts", 1, 12], ["src/b.ts", 3, 14])],
    );
  });

  it("refuses a report that lists no duplicates", () => {
    assert.throws(() => copiesIn({}, "/work/fathom"), /lists no duplicates/);
  });

  it("maps each renamed file's old path to its new one, leaving other changes out", () => {
    assert.deepEqual(
      renamesIn(
        "M\tREADME.md\nR096\tsrc/old.ts\tsrc/new.ts\nA\tsrc/added.ts\n",
      ),
      new Map([["src/old.ts", "src/new.ts"]]),
    );
  });
});

describe("checking a repository's change", () => {
  let repository;

  // A block well over the 100 tokens .jscpd.json asks for.
  const block = Array.from(
    { length: 12 },
    (_, index) =>
      `export function step${index}(value) {\n  return value * ${index} + ${index};\n}\n`,
  ).join("");

  function git(...args) {
    const result = spawnSync("git", args, {
      cwd: repository,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
  }

  function write(path, text) {
    mkdirSync(join(repository, path, ".."), { recursive: true });
    writeFileSync(join(repository, path), text);
  }

  beforeEach(() => {
    repository = mkdtempSync(join(tmpdir(), "fathom-duplicates-test-"));
    git("init", "--quiet", "--initial-branch=main");
    git("config", "user.email", "tester@example.test");
    git("config", "user.name", "Tester");
    const config = readFileSync(
      new URL("../.jscpd.json", import.meta.url),
      "utf8",
    );
    write(".jscpd.json", config);
    // jscpd refuses a folder the settings name that doesn't exist.
    for (const folder of JSON.parse(config).path)
      write(join(folder, "README.md"), "A folder the scan reads.\n");
    write("packages/one/src/first.ts", block);
    write("packages/one/src/second.ts", `// An older copy.\n${block}`);
    git("add", ".");
    git("commit", "--quiet", "--message", "start");
    git("update-ref", "refs/remotes/origin/main", "HEAD");
  });

  afterEach(() => rmSync(repository, { recursive: true, force: true }));

  it("passes over an older copy, and when its file is renamed", () => {
    assert.equal(lintDuplicates(repository).passed, true);
    git("mv", "packages/one/src/second.ts", "packages/one/src/renamed.ts");
    assert.equal(lintDuplicates(repository).passed, true);
  });

  it("fails on a new copy, even one not yet committed", () => {
    write("apps/two/src/third.ts", block);
    const verdict = lintDuplicates(repository);
    assert.equal(verdict.passed, false);
    assert.match(verdict.lines.join("\n"), /apps\/two\/src\/third\.ts/);
  });

  it("fails when origin/main can't be found", () => {
    git("update-ref", "-d", "refs/remotes/origin/main");
    assert.throws(() => lintDuplicates(repository), /git merge-base/);
  });
});
