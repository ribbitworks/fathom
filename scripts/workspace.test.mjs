// SPDX-License-Identifier: Apache-2.0

// Tests of reading the workspace's packages: each folder under apps/ and packages/ that holds a
// package.json, with its manifest, leaving out other folders and files.

import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { workspaceManifests } from "./workspace.mjs";

describe("reading the workspace's packages", () => {
  it("gives each package folder with its manifest, and nothing else", (context) => {
    const root = mkdtempSync(join(tmpdir(), "fathom-workspace-"));
    context.after(() => rmSync(root, { recursive: true, force: true }));
    const add = (folder, manifest) => {
      mkdirSync(join(root, folder), { recursive: true });
      writeFileSync(
        join(root, folder, "package.json"),
        JSON.stringify(manifest),
      );
    };
    add("apps/server", { name: "@fictional/server" });
    add("packages/shared", { name: "@fictional/shared" });
    mkdirSync(join(root, "packages/empty"));
    writeFileSync(join(root, "packages/notes.txt"), "Not a package");

    assert.deepEqual(
      workspaceManifests(root).sort((one, other) =>
        one.folder.localeCompare(other.folder),
      ),
      [
        { folder: "apps/server", manifest: { name: "@fictional/server" } },
        { folder: "packages/shared", manifest: { name: "@fictional/shared" } },
      ],
    );
  });

  it("reads this repository's packages by default", () => {
    const folders = workspaceManifests().map(({ folder }) => folder);
    assert.ok(folders.includes("apps/server"));
    assert.ok(folders.includes("packages/shared"));
  });
});
