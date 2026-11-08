// SPDX-License-Identifier: Apache-2.0

// Tests of reading when Trivy's vulnerability database was built, from 'trivy version', and which
// configuration a saved image has, from its manifest.json, including as commands.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { databaseVersion, imageConfig } from "./trivy-facts.mjs";

const script = fileURLToPath(new URL("trivy-facts.mjs", import.meta.url));

describe("Trivy's database version", () => {
  it("is when the vulnerability database was built", () => {
    assert.equal(
      databaseVersion(
        JSON.stringify({
          Version: "0.76.1",
          VulnerabilityDB: { UpdatedAt: "2026-11-07T18:32:58Z" },
        }),
      ),
      "2026-11-07T18:32:58Z",
    );
  });

  it("is unknown when Trivy names no database or does not answer in JSON", () => {
    for (const text of ["{}", '{"VulnerabilityDB":{}}', "not json", ""]) {
      assert.equal(databaseVersion(text), undefined, text);
    }
  });
});

describe("a saved image's configuration", () => {
  const config = `blobs/sha256/${"a".repeat(64)}`;

  it("is the one configuration its manifest names", () => {
    assert.equal(
      imageConfig(JSON.stringify([{ Config: config, Layers: [] }])),
      config,
    );
    assert.equal(
      imageConfig(
        JSON.stringify([{ Config: `sha256:${"b".repeat(64)}.json` }]),
      ),
      `sha256:${"b".repeat(64)}.json`,
    );
  });

  it("is unknown for several images, none, or anything but a digest", () => {
    for (const manifest of [
      [{ Config: config }, { Config: config }],
      [],
      [{ Config: "latest" }],
      [{}],
      { Config: config },
    ]) {
      assert.equal(imageConfig(JSON.stringify(manifest)), undefined);
    }
    assert.equal(imageConfig("not json"), undefined);
  });
});

describe("the command", () => {
  it("prints the fact read on standard input, or exits 1 when it cannot", () => {
    const read = (fact, input) =>
      spawnSync("node", [script, fact], { input, encoding: "utf8" });
    const version = read(
      "database-version",
      JSON.stringify({
        VulnerabilityDB: { UpdatedAt: "2026-11-07T18:32:58Z" },
      }),
    );
    assert.equal(version.status, 0);
    assert.equal(version.stdout, "2026-11-07T18:32:58Z\n");
    assert.equal(read("image-config", "[]").status, 1);
    assert.equal(read("anything", "{}").status, 2);
  });
});
