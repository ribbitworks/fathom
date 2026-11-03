// SPDX-License-Identifier: Apache-2.0

// Reads a copy of the repository's clone number from its git-ignored .dev/clone, as scripts/lib.sh
// does, for tests and scripts written in TypeScript or JavaScript that name containers and images.

import { readFileSync } from "node:fs";
import { join } from "node:path";

// The name given, followed by the copy's clone number unless it is clone 1.
export function cloneName(name: string, repositoryRoot: string): string {
  let clone = "";
  try {
    clone = readFileSync(join(repositoryRoot, ".dev/clone"), "utf8").trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  if (clone === "" || clone === "1") return name;
  if (!/^[1-9]$/.test(clone))
    throw new Error(".dev/clone must hold a clone number from 1 to 9");
  return `${name}-${clone}`;
}
