// SPDX-License-Identifier: Apache-2.0

// Tests of scripts/stack.sh's check of FATHOM_STACK_PORT. Run without a command, the script stops
// after the check, at its usage message or for want of a container runtime, so no container starts.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("stack.sh", import.meta.url));
const rejected = /FATHOM_STACK_PORT must be a port number from 1 to 65535/;

function stack(port) {
  return spawnSync("bash", [script], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      FATHOM_STACK_PORT: port,
    },
  });
}

describe("scripts/stack.sh", () => {
  it("accepts ports from 1 to 65535, with or without leading zeros", () => {
    for (const port of [
      "1",
      "9443",
      "09443",
      "0000009443",
      "65535",
      "00065535",
    ]) {
      const result = stack(port);
      assert.equal(result.status, 1, port);
      assert.doesNotMatch(result.stderr, rejected, port);
    }
  });

  it("rejects anything else, including numbers too long to compare", () => {
    for (const port of [
      "0",
      "000",
      "65536",
      "00065536",
      "100000",
      "99999999999999999999",
      "94a3",
      "-1",
      " 9443",
    ]) {
      const result = stack(port);
      assert.equal(result.status, 1, port);
      assert.match(result.stderr, rejected, port);
    }
  });
});
