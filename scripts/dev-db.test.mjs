// SPDX-License-Identifier: Apache-2.0

// Tests of restoring the development database's fictional data. Each test runs the script from a
// copy in a throwaway folder, with stand-ins for the container runtime, pnpm and the seed program,
// so no database is needed.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const developmentSecrets = [
  "postgres_superuser_password",
  "fathom_migrator_password",
  "fathom_app_password",
  "fathom_auth_secret",
  "dev_account_password",
];
const folders = [];

function tool(tools, name, body) {
  writeFileSync(join(tools, name), `#!/bin/sh\n${body}\n`, { mode: 0o755 });
}

// A copy of the script whose seed program records each step it is asked for, and fails at the step
// named, if any.
function copy(failingStep = "") {
  const root = mkdtempSync(join(tmpdir(), "fathom-dev-db-"));
  folders.push(root);
  mkdirSync(join(root, "scripts"));
  for (const name of ["lib.sh", "dev-db.sh"])
    copyFileSync(join(scripts, name), join(root, "scripts", name));
  mkdirSync(join(root, ".dev", "secrets"), { recursive: true });
  for (const name of developmentSecrets)
    writeFileSync(join(root, ".dev", "secrets", name), "fictional-secret\n");
  const tools = join(root, "tools");
  mkdirSync(tools);
  tool(tools, "docker", "exit 0");
  tool(tools, "pnpm", "exit 0");
  const steps = join(root, "steps");
  tool(tools, "node", `echo "$2" >>"${steps}"\n[ "$2" != "${failingStep}" ]`);
  return { root, tools, steps };
}

function reseed({ root, tools }) {
  return spawnSync("bash", ["scripts/dev-db.sh", "reseed"], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: `${tools}:${process.env.PATH ?? ""}`, HOME: process.env.HOME },
  });
}

afterEach(() => {
  for (const made of folders.splice(0))
    rmSync(made, { recursive: true, force: true });
});

describe("scripts/dev-db.sh reseed", () => {
  it("removes the fictional data, then adds it again and ends with the password", () => {
    const repository = copy();
    const result = reseed(repository);
    assert.equal(result.status, 0, result.stderr);
    assert.equal(readFileSync(repository.steps, "utf8"), "unseed\nseed\n");
    assert.match(
      result.stdout.trimEnd().split("\n").at(-1),
      /with the password fictional-secret$/,
    );
  });

  it("adds nothing when removing fails", () => {
    const repository = copy("unseed");
    const result = reseed(repository);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(repository.steps, "utf8"), "unseed\n");
  });

  it("fails when adding the data again fails", () => {
    const repository = copy("seed");
    const result = reseed(repository);
    assert.notEqual(result.status, 0);
    assert.equal(readFileSync(repository.steps, "utf8"), "unseed\nseed\n");
  });

  it("asks for the setup command and runs nothing without the secrets", () => {
    const repository = copy();
    rmSync(join(repository.root, ".dev"), { recursive: true });
    const result = reseed(repository);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /run 'pnpm dev:setup' first/);
    assert.ok(!existsSync(repository.steps));
  });
});
