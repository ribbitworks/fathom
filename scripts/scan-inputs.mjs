// SPDX-License-Identifier: Apache-2.0

// Decides what can change the security scans' results: which changed paths decide the image scan,
// and a hash of the files that decide the dependency scan.

import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { pathToFileURL } from "node:url";
import { changedPaths } from "./changed-paths.mjs";

export const unchanged = "unchanged";

const codeAndDocuments =
  /\.(ts|tsx|mjs|cjs|js|css|md|sql|sh|svg|png|ico|html)$/;

const scanScripts = new Set([
  "scripts/lib.sh",
  "scripts/security-report.sh",
  "scripts/scan-images.sh",
  "scripts/scan-inputs.mjs",
  "scripts/changed-paths.mjs",
  "scripts/scan-reuse.mjs",
  "scripts/trivy-facts.mjs",
  "scripts/combine-image-reports.mjs",
  "scripts/fix-dates.mjs",
  "scripts/offline.mjs",
  "scripts/vulnerabilities.mjs",
  "scripts/security-summary.mjs",
  "scripts/prune-reports.mjs",
]);

export const imageInputsDescription =
  "every file other than Fathom's code, tests, documents and pictures, such as the Dockerfiles, the Compose files, the lockfile and the exceptions, and the scan's scripts";

export function canChangeScans(path) {
  return !path.startsWith("docs/") && !codeAndDocuments.test(path);
}

// Everything in an image's build folder counts, whatever it is, since the image is built from it.
export function decidesImageScan(path) {
  return (
    scanScripts.has(path) ||
    path.startsWith("deploy/docker/") ||
    canChangeScans(path)
  );
}

export function changedImageInputs(paths) {
  return paths.filter(decidesImageScan);
}

function filesIn(folder) {
  return readdirSync(folder, { recursive: true, withFileTypes: true })
    .filter((entry) => entry.isFile())
    .map((entry) => relative(folder, join(entry.parentPath, entry.name)))
    .filter((path) => !/^(node_modules|\.git)(\/|$)/.test(path))
    .sort();
}

export function dependencyFilesHash(folder) {
  const hash = createHash("sha256");
  for (const path of filesIn(folder).filter(canChangeScans)) {
    const contents = createHash("sha256")
      .update(readFileSync(join(folder, path)))
      .digest("hex");
    hash.update(`${path}\0${contents}\n`);
  }
  return hash.digest("hex");
}

function main([command, folder]) {
  if (command === "image-scan") {
    const changed = changedImageInputs(changedPaths());
    console.log(changed.length > 0 ? changed.join("\n") : unchanged);
    return 0;
  }
  if (command === "dependency-hash" && folder) {
    console.log(dependencyFilesHash(folder));
    return 0;
  }
  console.error(
    "Usage: node scripts/scan-inputs.mjs image-scan | dependency-hash <folder>",
  );
  return 2;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 2;
  }
}
