// SPDX-License-Identifier: Apache-2.0

// Checks every service in every Compose file keeps the container hardening the security plan
// requires. Trivy has no scanner for Compose files, so these tests are the automated check.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readdirSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const deployFolder = fileURLToPath(new URL("../deploy/", import.meta.url));
const composeFiles = readdirSync(deployFolder).filter((name) =>
  /^compose.*\.ya?ml$/.test(name),
);

function effectiveConfiguration(composeFile) {
  const output = execFileSync(
    "docker",
    [
      "compose",
      "--file",
      `${deployFolder}${composeFile}`,
      "--profile",
      "*",
      "config",
      "--format",
      "json",
    ],
    {
      encoding: "utf8",
    },
  );
  return JSON.parse(output);
}

describe("container hardening", () => {
  it("finds the Compose files to check", () => {
    assert.ok(composeFiles.length > 0);
  });

  for (const composeFile of composeFiles) {
    const services = Object.entries(
      effectiveConfiguration(composeFile).services ?? {},
    );

    for (const [name, service] of services) {
      describe(`${composeFile}: ${name}`, () => {
        it("runs as a user other than root", () => {
          assert.ok(service.user, "a user must be set");
          assert.doesNotMatch(String(service.user), /^(root|0)(:|$)/);
        });

        it("has a read-only filesystem", () => {
          assert.equal(service.read_only, true);
        });

        it("drops every Linux capability and adds none back", () => {
          assert.deepEqual(service.cap_drop, ["ALL"]);
          assert.ok(!service.cap_add || service.cap_add.length === 0);
        });

        it("cannot gain new privileges", () => {
          assert.ok(
            (service.security_opt ?? []).includes("no-new-privileges:true"),
          );
        });

        it("publishes ports only on this machine", () => {
          for (const port of service.ports ?? []) {
            assert.equal(
              port.host_ip,
              "127.0.0.1",
              `port ${String(port.target)}`,
            );
          }
        });

        it("is not privileged and does not share the host's network", () => {
          assert.notEqual(service.privileged, true);
          assert.notEqual(service.network_mode, "host");
        });
      });
    }
  }
});
