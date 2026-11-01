// SPDX-License-Identifier: Apache-2.0

// Checks that development-only code stays out of the application's runtime image, so the
// development accounts and their shared password can never reach production: the image build is
// sent no file from the seed data, fixtures, or test helpers' source, and the server depends on no
// development-only package, directly or through another workspace package.

import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { describe, it } from "node:test";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

const developmentOnly = ["@fathom/seed", "@fathom/fixtures"];

// Every workspace package, by name, with the workspace packages it needs at run time.
const workspace = new Map(
  ["apps", "packages"].flatMap((group) =>
    readdirSync(new URL(`../${group}/`, import.meta.url)).flatMap((folder) => {
      let manifest;
      try {
        manifest = JSON.parse(read(`${group}/${folder}/package.json`));
      } catch {
        return [];
      }
      const needs = Object.keys({
        ...manifest.dependencies,
        ...manifest.optionalDependencies,
      }).filter((name) => name.startsWith("@fathom/"));
      return [[manifest.name, needs]];
    }),
  ),
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
});
