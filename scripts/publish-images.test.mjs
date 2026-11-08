// SPDX-License-Identifier: Apache-2.0

// Tests of scripts/publish-images.sh's checks before it builds anything, and of the web address
// scripts/lib.sh gives the images as their source. Neither needs a container runtime.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const script = fileURLToPath(new URL("publish-images.sh", import.meta.url));
const lib = fileURLToPath(new URL("lib.sh", import.meta.url));

function publish(...args) {
  return spawnSync("bash", [script, ...args], { encoding: "utf8" });
}

function httpsUrl(url) {
  return spawnSync(
    "bash",
    ["-c", 'source "$1" && fathom_https_url "$2"', "_", lib, url],
    { encoding: "utf8" },
  );
}

describe("scripts/publish-images.sh", () => {
  it("needs exactly one tag", () => {
    for (const args of [[], ["--dry-run"], ["v1.0.0", "v1.0.1"], ["--push"]]) {
      const result = publish(...args);
      assert.equal(result.status, 1, args.join(" "));
      assert.match(result.stderr, /Usage: pnpm publish:images/);
    }
  });

  it("refuses a tag that is not a release tag", () => {
    for (const tag of ["1.0.0", "v1.0", "v01.0.0", "v1.0.0+7", "latest"]) {
      const result = publish("--dry-run", tag);
      assert.equal(result.status, 1, tag);
      assert.match(result.stderr, /is not a release tag/, tag);
    }
  });

  it("refuses a release tag that does not exist", () => {
    const result = publish("--dry-run", "v999999.0.0");
    assert.equal(result.status, 1);
    assert.match(result.stderr, /There is no tag v999999\.0\.0/);
  });
});

describe("fathom_https_url", () => {
  it("gives a repository's web address without credentials, a query, or an ssh port", () => {
    for (const [url, expected] of [
      ["git@example.com:owner/fathom.git", "https://example.com/owner/fathom"],
      [
        "https://user:token@example.com/owner/fathom.git",
        "https://example.com/owner/fathom",
      ],
      [
        "ssh://git@example.com:2222/owner/fathom.git",
        "https://example.com/owner/fathom",
      ],
      [
        "https://a@b@example.com/owner/fathom",
        "https://example.com/owner/fathom",
      ],
      [
        "https://user:token@example.com/owner/fathom.git?token=x#top",
        "https://example.com/owner/fathom",
      ],
      [
        "https://example.com:8443/group/owner/fathom/",
        "https://example.com:8443/group/owner/fathom",
      ],
    ]) {
      const result = httpsUrl(url);
      assert.equal(result.status, 0, url);
      assert.equal(result.stdout, `${expected}\n`, url);
    }
  });

  it("fails for a folder on this machine", () => {
    for (const url of ["/srv/git/fathom.git", "file:///srv/git/fathom", ""])
      assert.equal(httpsUrl(url).status, 1, url);
  });
});
