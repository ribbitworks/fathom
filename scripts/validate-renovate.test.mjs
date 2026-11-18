// SPDX-License-Identifier: Apache-2.0

// Tests of validating renovate.json only when it changed since origin/main, or when that can't be
// told, and failing when the validator refuses it.

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
const folders = [];

function validate(environment) {
  const root = mkdtempSync(join(tmpdir(), "fathom-renovate-"));
  folders.push(root);
  mkdirSync(join(root, "scripts"));
  for (const name of ["lib.sh", "validate-renovate.sh"])
    copyFileSync(join(scripts, name), join(root, "scripts", name));
  writeFileSync(
    join(root, "scripts", "changed-paths.mjs"),
    'if (process.env.CHANGED === undefined) process.exit(1);\nfor (const path of process.env.CHANGED.split(" ")) console.log(path);\n',
  );
  const tools = join(root, "tools");
  mkdirSync(tools);
  writeFileSync(
    join(tools, "docker"),
    `#!/usr/bin/env bash\n[ "$1" = info ] && exit 0\necho "$*" >>"${join(root, "docker.log")}"\n[ -z "\${REFUSE:-}" ]\n`,
    { mode: 0o755 },
  );
  const result = spawnSync("bash", ["scripts/validate-renovate.sh"], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: `${tools}:${process.env.PATH ?? ""}`,
      HOME: process.env.HOME,
      ...environment,
    },
  });
  const log = join(root, "docker.log");
  return { ...result, ran: existsSync(log) ? readFileSync(log, "utf8") : "" };
}

afterEach(() => {
  for (const made of folders.splice(0))
    rmSync(made, { recursive: true, force: true });
});

describe("scripts/validate-renovate.sh", () => {
  it("leaves renovate.json alone when it has not changed", () => {
    const result = validate({ CHANGED: "package.json scripts/check.sh" });
    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      result.stdout.includes(
        "renovate.json has not changed since origin/main, so it is not validated",
      ),
      result.stdout,
    );
    assert.equal(result.ran, "");
  });

  it("validates renovate.json strictly, with no network, when it changed", () => {
    const result = validate({ CHANGED: "package.json renovate.json" });
    assert.equal(result.status, 0, result.stderr);
    assert.match(
      result.ran,
      /^run --rm --network none .*--entrypoint renovate-config-validator renovate\/renovate:[^ ]+ --strict$/m,
    );
  });

  it("validates renovate.json when it can't tell what changed", () => {
    const result = validate({});
    assert.equal(result.status, 0, result.stderr);
    assert.ok(
      result.stdout.includes(
        "Could not tell whether renovate.json changed since origin/main, so it is validated",
      ),
      result.stdout,
    );
    assert.match(result.ran, /renovate-config-validator/);
  });

  it("fails when the validator refuses the settings", () => {
    const result = validate({ CHANGED: "renovate.json", REFUSE: "1" });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "error: renovate.json is not valid; see the validator's output above",
      ),
      result.stderr,
    );
  });
});
