// SPDX-License-Identifier: Apache-2.0

// Reads two facts the reuse of Trivy's results is keyed on: when Trivy's vulnerability database was
// built, from 'trivy version', and which configuration a saved image has, from its manifest.json.
// The configuration names every layer by its contents, so it is the same for every build of the
// same image, unlike the image's ID, which build attestations change.
// Usage:
//   trivy version --format json | node scripts/trivy-facts.mjs database-version
//   tar -xOf <saved image> manifest.json | node scripts/trivy-facts.mjs image-config
// Each prints the fact, or exits 1 when it cannot be read.

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// When the vulnerability database 'trivy version --format json' describes was built, or undefined.
export function databaseVersion(text) {
  try {
    const updated = JSON.parse(text)?.VulnerabilityDB?.UpdatedAt;
    return typeof updated === "string" && updated !== "" ? updated : undefined;
  } catch {
    return undefined;
  }
}

// The configuration a saved image of one platform names in its manifest.json, or undefined.
export function imageConfig(text) {
  try {
    const manifest = JSON.parse(text);
    const config =
      Array.isArray(manifest) && manifest.length === 1
        ? manifest[0]?.Config
        : undefined;
    return typeof config === "string" &&
      /sha256[:/][0-9a-f]{64}(\.json)?$/.test(config)
      ? config
      : undefined;
  } catch {
    return undefined;
  }
}

const readers = new Map([
  ["database-version", databaseVersion],
  ["image-config", imageConfig],
]);

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const read = readers.get(process.argv[2] ?? "");
  if (read === undefined) {
    console.error(
      "Usage: node scripts/trivy-facts.mjs database-version|image-config",
    );
    process.exitCode = 2;
  } else {
    const fact = read(readFileSync(0, "utf8"));
    if (fact === undefined) process.exitCode = 1;
    else console.log(fact);
  }
}
