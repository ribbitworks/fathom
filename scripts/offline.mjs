// SPDX-License-Identifier: Apache-2.0

// Helpers for working offline: whether the internet answers, keeping Semgrep's rules, and the image
// Testcontainers starts beside each test database.

import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// The package registry, which the dependency audit asks, stands for the internet.
export const registry = "https://registry.npmjs.org/";
const answerTimeout = 10_000;
const downloadTimeout = 120_000;

// Whether the address answers at all within the time given; any answer, even a refusal, counts.
export async function reachable(
  address,
  { fetch = globalThis.fetch, timeout = answerTimeout } = {},
) {
  try {
    await fetch(address, {
      method: "HEAD",
      signal: AbortSignal.timeout(timeout),
    });
    return true;
  } catch {
    return false;
  }
}

// Fetches Semgrep's rules into the file, replacing it only once they have all arrived and hold at
// least one rule, so a failed or empty answer can't leave the code scan checking nothing.
export async function keepRules(
  address,
  file,
  { fetch = globalThis.fetch, timeout = downloadTimeout } = {},
) {
  const response = await fetch(address, {
    signal: AbortSignal.timeout(timeout),
  });
  if (!response.ok) throw new Error(`${address} answered ${response.status}`);
  const text = await response.text();
  let rules;
  try {
    rules = JSON.parse(text)?.rules;
  } catch {
    rules = undefined;
  }
  if (!Array.isArray(rules) || rules.length === 0)
    throw new Error(`${address} sent no rules`);
  const partial = `${file}.partial`;
  writeFileSync(partial, text);
  renameSync(partial, file);
}

const ryukPattern = /"(testcontainers\/ryuk:[^"]+)"/;

// The Ryuk image Testcontainers starts, from its source, unless RYUK_CONTAINER_IMAGE names
// another, as Testcontainers allows.
export function ryukImage(reaperSource, environment = process.env) {
  if (environment.RYUK_CONTAINER_IMAGE) return environment.RYUK_CONTAINER_IMAGE;
  const image = ryukPattern.exec(reaperSource)?.[1];
  if (image === undefined)
    throw new Error("Could not find the Ryuk image in Testcontainers");
  return image;
}

// Testcontainers' reaper, as the test helpers' copy of the PostgreSQL module installs it.
export function reaperSource(
  root = fileURLToPath(new URL("..", import.meta.url)),
) {
  const testUtilities = createRequire(
    join(root, "packages/test-utils/package.json"),
  );
  const postgres = createRequire(
    testUtilities.resolve("@testcontainers/postgresql"),
  );
  const entry = postgres.resolve("testcontainers");
  return readFileSync(join(dirname(entry), "reaper/reaper.js"), "utf8");
}

async function main([command, ...rest]) {
  if (command === "online" && rest.length === 0)
    return (await reachable(registry)) ? 0 : 1;
  if (command === "rules" && rest.length === 2) {
    await keepRules(rest[0], rest[1]);
    return 0;
  }
  if (command === "ryuk-image" && rest.length === 0) {
    console.log(ryukImage(reaperSource()));
    return 0;
  }
  console.error(
    "Usage: node scripts/offline.mjs online, rules <address> <file>, or ryuk-image",
  );
  return 2;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = await main(process.argv.slice(2));
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 1;
  }
}
