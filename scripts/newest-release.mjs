// SPDX-License-Identifier: Apache-2.0

// Prints the newest full release among the tags read on standard input, one a line, leaving out
// pre-releases, since a full release is what people most likely run; prints nothing before the
// first. Release tags follow scripts/release.mjs's rules.
// Usage: git tag --list 'v*' | node scripts/newest-release.mjs

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { latestFullRelease } from "./release.mjs";

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const newest = latestFullRelease(readFileSync(0, "utf8").split("\n"));
  if (newest !== undefined) console.log(newest.tag);
}
