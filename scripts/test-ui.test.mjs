// SPDX-License-Identifier: Apache-2.0

// Tests of 'pnpm test:ui': it needs the development server running, then reseeds the fictional data
// and runs the UI tests against this copy's server.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const folders = [];

function run({
  serverUp,
  clone = "",
  args = [],
  reseedFails = false,
  testsFail = false,
}) {
  const root = realpathSync(mkdtempSync(join(tmpdir(), "fathom-test-ui-")));
  folders.push(root);
  mkdirSync(join(root, "scripts"));
  for (const name of ["lib.sh", "test-ui.sh"])
    copyFileSync(join(scripts, name), join(root, "scripts", name));
  const calls = join(root, "calls.log");
  writeFileSync(
    join(root, "scripts", "dev-db.sh"),
    `echo "dev-db $* show=\${FATHOM_DEV_SHOW_PASSWORD:-}" >>"${calls}"\nexit ${reseedFails ? 1 : 0}\n`,
  );
  mkdirSync(join(root, ".dev", "secrets"), { recursive: true });
  writeFileSync(join(root, ".dev", "secrets", "dev_account_password"), "x\n");
  if (clone !== "") writeFileSync(join(root, ".dev", "clone"), `${clone}\n`);
  const tools = join(root, "tools");
  mkdirSync(tools);
  writeFileSync(
    join(tools, "curl"),
    `#!/usr/bin/env bash\necho "curl $*" >>"${calls}"\nexit ${serverUp ? 0 : 7}\n`,
    { mode: 0o755 },
  );
  writeFileSync(
    join(tools, "pnpm"),
    `#!/usr/bin/env bash\necho "pnpm $* url=\${FATHOM_UI_URL:-} password=\${FATHOM_UI_PASSWORD_FILE:-} ca=\${NODE_EXTRA_CA_CERTS:-}" >>"${calls}"\ncase "$*" in *"playwright test"*) exit ${testsFail ? 1 : 0} ;; esac\n`,
    { mode: 0o755 },
  );
  writeFileSync(join(tools, "mkcert"), "#!/usr/bin/env bash\necho /ca\n", {
    mode: 0o755,
  });
  const result = spawnSync("bash", ["scripts/test-ui.sh", ...args], {
    cwd: root,
    encoding: "utf8",
    env: { PATH: `${tools}:${process.env.PATH ?? ""}`, HOME: process.env.HOME },
  });
  const called = existsSync(calls) ? readFileSync(calls, "utf8") : "";
  return { ...result, root, called };
}

afterEach(() => {
  for (const made of folders.splice(0))
    rmSync(made, { recursive: true, force: true });
});

describe("scripts/test-ui.sh", () => {
  it("stops, naming pnpm dev, when the development server isn't running", () => {
    const result = run({ serverUp: false });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "Fathom isn't answering at https://localhost:8443; start it with 'pnpm dev', then try again",
      ),
      result.stderr,
    );
    assert.ok(!result.called.includes("dev-db"), result.called);
    assert.ok(!result.called.includes("pnpm"), result.called);
  });

  it("stops before the UI tests when the reseed fails", () => {
    const result = run({ serverUp: true, reseedFails: true });
    assert.notEqual(result.status, 0);
    assert.ok(result.called.includes("dev-db reseed"), result.called);
    assert.ok(!result.called.includes("pnpm"), result.called);
  });

  it("fails when the UI tests fail", () => {
    const result = run({ serverUp: true, testsFail: true });
    assert.notEqual(result.status, 0);
    assert.ok(result.called.includes("playwright test"), result.called);
  });

  it("reseeds, then runs the UI tests against this copy's server, passing its arguments on", () => {
    const result = run({
      serverUp: true,
      clone: "3",
      args: ["e2e/new-record.test.ts"],
    });
    assert.equal(result.status, 0, result.stderr);
    const password = join(result.root, ".dev/secrets/dev_account_password");
    const accountsFolder = join(result.root, ".tmp", "ui-accounts");
    assert.equal(statSync(accountsFolder).mode & 0o777, 0o700);
    assert.deepEqual(result.called.trim().split("\n"), [
      "curl --silent --max-time 10 --cacert /ca/rootCA.pem --output /dev/null https://localhost:8463/",
      "dev-db reseed show=false",
      `pnpm --filter @fathom/web exec playwright install chromium url= password= ca=`,
      `pnpm --filter @fathom/web exec playwright test e2e/new-record.test.ts url=https://localhost:8463 password=${password} ca=/ca/rootCA.pem`,
    ]);
  });
});
