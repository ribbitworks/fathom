// SPDX-License-Identifier: Apache-2.0

// Reads the workspace's packages: each folder under apps/ and packages/ that holds a package.json,
// with its manifest, for the scripts and script tests that follow how the packages depend on each
// other.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export const packageGroups = ["apps", "packages"];

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

// Each package's folder from the root, such as apps/server, and its manifest.
export function workspaceManifests(root = repositoryRoot) {
  return packageGroups.flatMap((group) =>
    readdirSync(join(root, group), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => `${group}/${entry.name}`)
      .filter((folder) => existsSync(join(root, folder, "package.json")))
      .map((folder) => ({
        folder,
        manifest: JSON.parse(
          readFileSync(join(root, folder, "package.json"), "utf8"),
        ),
      })),
  );
}
