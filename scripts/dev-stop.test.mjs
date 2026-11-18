// SPDX-License-Identifier: Apache-2.0

// Tests of stopping a copy's development servers, which 'pnpm dev' does before it starts and
// 'pnpm dev:stop' does alone. Each test runs the script from a copy in a throwaway folder, with
// servers listening on ports the system picks.

import assert from "node:assert/strict";
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import {
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  realpathSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = fileURLToPath(new URL(".", import.meta.url));
const hasLsof = spawnSync("bash", ["-c", "command -v lsof"]).status === 0;
const folders = [];
const servers = [];

function folder() {
  const made = mkdtempSync(join(tmpdir(), "fathom-dev-stop-"));
  folders.push(made);
  return made;
}

function copy() {
  const root = folder();
  mkdirSync(join(root, "scripts"));
  for (const name of ["lib.sh", "dev-stop.sh"])
    copyFileSync(join(scripts, name), join(root, "scripts", name));
  return root;
}

// A server listening on a port the system picks, run from the folder given, and the port.
async function serverIn(cwd) {
  const server = spawn(
    process.execPath,
    [
      "-e",
      "const s = require('node:net').createServer().listen(0, '127.0.0.1', () => console.log(s.address().port));",
    ],
    { cwd, stdio: ["ignore", "pipe", "inherit"] },
  );
  servers.push(server);
  const [line] = await once(server.stdout, "data");
  return { server, port: String(line).trim() };
}

// Runs the script without blocking, so the servers it stops are reaped as they exit.
async function stop(root, webPort, apiPort, tools) {
  const script = spawn("bash", ["scripts/dev-stop.sh"], {
    cwd: root,
    env: {
      PATH:
        tools === undefined
          ? process.env.PATH
          : `${tools}:${process.env.PATH ?? ""}`,
      HOME: process.env.HOME,
      FATHOM_DEV_PORT: webPort,
      FATHOM_DEV_API_PORT: apiPort,
    },
  });
  let stdout = "";
  let stderr = "";
  script.stdout.on("data", (chunk) => (stdout += String(chunk)));
  script.stderr.on("data", (chunk) => (stderr += String(chunk)));
  const [status] = await once(script, "close");
  return { status, stdout, stderr };
}

const running = (server) =>
  server.exitCode === null && server.signalCode === null;

afterEach(() => {
  for (const server of servers.splice(0))
    if (running(server)) server.kill("SIGKILL");
  for (const made of folders.splice(0))
    rmSync(made, { recursive: true, force: true });
});

describe(
  "scripts/dev-stop.sh",
  { skip: !hasLsof && "lsof is not installed" },
  () => {
    it("stops this copy's servers, wherever in it they were started", async () => {
      const root = copy();
      mkdirSync(join(root, "apps"));
      const web = await serverIn(join(root, "apps"));
      const api = await serverIn(root);
      const exits = Promise.all([
        once(web.server, "exit"),
        once(api.server, "exit"),
      ]);
      const result = await stop(root, web.port, api.port);
      assert.equal(result.status, 0, result.stderr);
      assert.match(result.stdout, /Stopped this copy's development servers/);
      await exits;
    });

    it("does nothing when no server is running", async () => {
      const root = copy();
      // Ports below 1024 are never handed out by the system for these tests' servers.
      const result = await stop(root, "1", "2");
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "");
    });

    it("leaves another copy's server running and says whose port it is", async () => {
      const root = copy();
      // Named as a sibling clone is, starting with this copy's own folder name.
      const sibling = `${root}-2`;
      mkdirSync(sibling);
      folders.push(sibling);
      const other = await serverIn(sibling);
      const result = await stop(root, other.port, "2");
      assert.equal(result.status, 1);
      assert.ok(
        result.stderr.includes(
          `Port ${other.port} is in use by process ${String(other.server.pid)}, ${basename(process.execPath)}, in ${realpathSync(sibling)}, which is not this copy's`,
        ),
        result.stderr,
      );
      assert.ok(running(other.server));
    });

    it("stops nothing when either port is someone else's", async () => {
      const root = copy();
      const own = await serverIn(root);
      const other = await serverIn(folder());
      for (const [web, api] of [
        [own.port, other.port],
        [other.port, own.port],
      ]) {
        const result = await stop(root, web, api);
        assert.equal(result.status, 1);
        assert.ok(
          result.stderr.includes(`Port ${other.port} is in use`),
          result.stderr,
        );
        assert.ok(running(own.server));
        assert.ok(running(other.server));
      }
    });

    it("skips a server that exits before its folder is read", async () => {
      const root = copy();
      const gone = spawn(process.execPath, ["-e", ""]);
      await once(gone, "exit");
      // An lsof that names the exited server as the listener, and cannot read its folder.
      const tools = folder();
      writeFileSync(
        join(tools, "lsof"),
        `#!/usr/bin/env bash\nif [ "$1" = -nP ]; then echo ${String(gone.pid)}; exit 0; fi\nexit 1\n`,
        { mode: 0o755 },
      );
      const result = await stop(root, "1", "2", tools);
      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "");
    });
  },
);
