// SPDX-License-Identifier: Apache-2.0

// Tests of clone numbers, which let several copies of the repository run at once: scripts/lib.sh and
// scripts/clone.mjs read them, and 'pnpm dev:setup <number>' sets them. Each test runs the scripts
// from a copy in a throwaway folder, with its own .dev/clone.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { cloneName } from "./clone.mjs";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const which = (tool) =>
  spawnSync("bash", ["-c", `command -v ${tool}`], {
    encoding: "utf8",
  }).stdout.trim();
const folders = [];

// A throwaway copy holding the scripts named and, unless it is undefined, .dev/clone.
function copy(clone, ...names) {
  const root = mkdtempSync(join(tmpdir(), "fathom-clone-"));
  folders.push(root);
  mkdirSync(join(root, "scripts"));
  for (const name of ["lib.sh", ...names])
    copyFileSync(join(scripts, name), join(root, "scripts", name));
  if (clone !== undefined) {
    mkdirSync(join(root, ".dev"));
    writeFileSync(join(root, ".dev/clone"), clone);
  }
  return root;
}

// Runs bash in a copy with only PATH and HOME set, so the shell's own settings cannot leak in.
function bash(root, script, environment = {}) {
  return spawnSync("bash", ["-c", script], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: process.env.PATH, HOME: process.env.HOME, ...environment },
  });
}

const settings = `source scripts/lib.sh && printf '%s\\n' "$FATHOM_CLONE" "$FATHOM_DEV_PORT" \
  "$FATHOM_DEV_API_PORT" "$FATHOM_DEV_DB_PORT" "$FATHOM_STACK_PORT" "$(clone_name fathom-dev)"`;

function settingsOf(root, environment) {
  const result = bash(root, settings, environment);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim().split("\n");
}

afterEach(() => {
  for (const folder of folders.splice(0))
    rmSync(folder, { recursive: true, force: true });
});

describe("scripts/lib.sh", () => {
  it("keeps a single copy's ports and names without a clone number", () => {
    const single = ["1", "8443", "8444", "5432", "9443", "fathom-dev"];
    assert.deepEqual(settingsOf(copy(undefined)), single);
    assert.deepEqual(settingsOf(copy("")), single);
    assert.deepEqual(settingsOf(copy("1\n")), single);
  });

  it("gives each clone number its own ports and names", () => {
    assert.deepEqual(settingsOf(copy("3\n")), [
      "3",
      "8463",
      "8464",
      "5434",
      "9463",
      "fathom-dev-3",
    ]);
    assert.deepEqual(settingsOf(copy("9")), [
      "9",
      "8523",
      "8524",
      "5440",
      "9523",
      "fathom-dev-9",
    ]);
  });

  it("lets ports set in the environment win", () => {
    const ports = {
      FATHOM_DEV_PORT: "7000",
      FATHOM_DEV_API_PORT: "7001",
      FATHOM_DEV_DB_PORT: "7002",
      FATHOM_STACK_PORT: "7003",
    };
    assert.deepEqual(settingsOf(copy("2"), ports), [
      "2",
      "7000",
      "7001",
      "7002",
      "7003",
      "fathom-dev-2",
    ]);
  });

  it("rejects anything but a clone number from 1 to 9", () => {
    for (const clone of ["0", "10", "two", "2 3", "-1"]) {
      const result = bash(copy(clone), settings);
      assert.equal(result.status, 1, clone);
      assert.match(result.stderr, /clone number from 1 to 9/, clone);
    }
  });
});

describe("scripts/dev-setup.sh", () => {
  it("rejects anything but a clone number from 1 to 9, writing nothing", () => {
    for (const clone of ["0", "10", "two"]) {
      const root = copy(undefined, "dev-setup.sh");
      const result = bash(root, `bash scripts/dev-setup.sh ${clone}`);
      assert.equal(result.status, 1, clone);
      assert.match(result.stderr, /Usage: .*clone number from 1 to 9/, clone);
      assert.equal(existsSync(join(root, ".dev")), false, clone);
    }
  });

  it("replaces a clone number it would otherwise reject before reading it", () => {
    const root = copy("10", "dev-setup.sh");
    // Given only the tools it needs before generating secrets, it stops when it finds no openssl,
    // so it never creates secrets or certificates, but only after setting the number.
    const tools = join(root, "tools");
    mkdirSync(tools);
    for (const tool of ["bash", "date", "dirname", "mkdir", "chmod", "tr"])
      symlinkSync(which(tool), join(tools, tool));
    const result = bash(root, `${which("bash")} scripts/dev-setup.sh 4`, {
      PATH: tools,
    });
    assert.match(result.stderr, /openssl is required/);
    assert.equal(readFileSync(join(root, ".dev/clone"), "utf8"), "4\n");
    assert.deepEqual(settingsOf(root).slice(0, 2), ["4", "8473"]);
  });
});

describe("scripts/clone.mjs", () => {
  it("names things as scripts/lib.sh does", () => {
    assert.equal(cloneName("latest", copy(undefined)), "latest");
    assert.equal(cloneName("latest", copy("1\n")), "latest");
    assert.equal(cloneName("latest", copy("")), "latest");
    assert.equal(cloneName("latest", copy("3\n")), "latest-3");
  });

  it("rejects anything but a clone number from 1 to 9", () => {
    for (const clone of ["0", "10", "two"])
      assert.throws(
        () => cloneName("latest", copy(clone)),
        /clone number from 1 to 9/,
      );
  });
});
