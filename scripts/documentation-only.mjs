// SPDX-License-Identifier: Apache-2.0

// Prints "true" or "false", for the Check workflow, saying whether a pull request changes only
// documentation. Usage: node scripts/documentation-only.mjs <base commit>

import { pathToFileURL } from "node:url";
import { changedPaths } from "./changed-paths.mjs";
import { isDocumentation } from "./test-changed.mjs";

export function isDocumentationOnly(paths) {
  return paths.every(isDocumentation);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const [base] = process.argv.slice(2);
  if (base === undefined || base === "") {
    console.error("error: Usage: documentation-only.mjs <base commit>");
    process.exit(2);
  }
  try {
    console.log(String(isDocumentationOnly(changedPaths({ since: base }))));
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(1);
  }
}
