// SPDX-License-Identifier: Apache-2.0

// Checks that development-only code stays out of the application's runtime image, so the
// development accounts and limits can never reach production: no development-only file or package
// goes into the image, directly or through another package, and the server runs in production mode.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { workspaceManifests } from "./workspace.mjs";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const developmentOnly = ["@fathom/seed", "@fathom/fixtures"];

// Development-only files kept in packages whose other files the image needs.
const developmentOnlyFiles = ["packages/db/test-databases.ts"];

// Every workspace package, by name, with the workspace packages it needs at run time.
const workspace = new Map(
  workspaceManifests().map(({ manifest }) => [
    manifest.name,
    Object.keys({
      ...manifest.dependencies,
      ...manifest.optionalDependencies,
    }).filter((name) => name.startsWith("@fathom/")),
  ]),
);

describe("the runtime image", () => {
  it("is sent no file from the development-only packages", () => {
    const included = read("deploy/docker/app/Dockerfile.dockerignore")
      .split("\n")
      .filter((line) => line.startsWith("!"))
      .map((line) => line.slice(1));
    for (const path of included) {
      assert.ok(
        !/^packages\/(seed|fixtures)\b/.test(path) &&
          !path.startsWith("packages/test-utils/src"),
        `The image build is sent ${path}`,
      );
      for (const file of developmentOnlyFiles) {
        assert.ok(
          file !== path &&
            !file.startsWith(path.endsWith("/") ? path : `${path}/`),
          `The image build is sent ${file}, through ${path}`,
        );
      }
    }
  });

  it("holds a server that needs no development-only package, directly or indirectly", () => {
    const needed = new Set();
    const visit = (name) => {
      for (const dependency of workspace.get(name) ?? []) {
        if (needed.has(dependency)) continue;
        needed.add(dependency);
        visit(dependency);
      }
    };
    visit("@fathom/server");
    assert.ok(needed.has("@fathom/db"), "The server's packages were not found");
    for (const name of developmentOnly) {
      assert.ok(!needed.has(name), `The server needs ${name}`);
    }
  });

  // The server refuses the development limits in production mode.
  it("runs the server in production mode", () => {
    const stages = read("deploy/docker/app/Dockerfile").split(/^FROM /m);
    assert.match(stages.at(-1) ?? "", /^ENV NODE_ENV=production$/m);
  });
});
