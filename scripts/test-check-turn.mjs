// SPDX-License-Identifier: Apache-2.0

// Shared setup for the tests of scripts that wait for a check's turn: a stand-in for check-turn.mjs
// that prints the command it was given, or, with TURN_RUNS=1, runs it as in its turn.

import { writeFileSync } from "node:fs";
import { join } from "node:path";

export function writeCheckTurn(scriptsFolder) {
  writeFileSync(
    join(scriptsFolder, "check-turn.mjs"),
    [
      'import { spawnSync } from "node:child_process";',
      "const [command, ...args] = process.argv.slice(2);",
      'if (process.env.TURN_RUNS !== "1") {',
      "  console.log(`turn: ${JSON.stringify([command, ...args])}`);",
      "  process.exit(0);",
      "}",
      "const { status } = spawnSync(command, args, {",
      '  stdio: "inherit",',
      '  env: { ...process.env, FATHOM_CHECK_SLOT: "1" },',
      "});",
      "process.exit(status ?? 1);",
      "",
    ].join("\n"),
  );
}
