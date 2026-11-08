// SPDX-License-Identifier: Apache-2.0

// Tests of the Compose configuration a release's images are built from.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { releaseCompose } from "./release-compose.mjs";

const script = fileURLToPath(new URL("release-compose.mjs", import.meta.url));

const release = {
  registry: "registry.example.com/team/",
  version: "0.1.0",
  revision: "0123456789abcdef0123456789abcdef01234567",
  epoch: "1762570000",
  created: "2026-11-07T20:53:51-08:00",
  source: "https://example.com/owner/fathom",
};

const config = {
  name: "fathom",
  services: {
    app: {
      image: "fathom-app:latest",
      build: { context: "/src", args: { FATHOM_VERSION: "0.1.0" } },
    },
    proxy: { image: "fathom-proxy:latest", build: { context: "/src" } },
    other: { image: "example/other:1" },
  },
};

describe("releaseCompose", () => {
  it("names each built image for the registry and the version", () => {
    const { services } = releaseCompose(config, release);
    assert.equal(
      services.app.image,
      "registry.example.com/team/fathom-app:0.1.0",
    );
    assert.equal(
      services.proxy.image,
      "registry.example.com/team/fathom-proxy:0.1.0",
    );
    assert.deepEqual(services.other, config.services.other);
  });

  it("labels each built image and dates it by the commit, keeping its build arguments", () => {
    const { build } = releaseCompose(config, release).services.app;
    assert.deepEqual(build.args, {
      FATHOM_VERSION: "0.1.0",
      SOURCE_DATE_EPOCH: "1762570000",
    });
    assert.deepEqual(build.labels, {
      "org.opencontainers.image.source": "https://example.com/owner/fathom",
      "org.opencontainers.image.licenses": "Apache-2.0",
      "org.opencontainers.image.version": "0.1.0",
      "org.opencontainers.image.revision": release.revision,
      "org.opencontainers.image.created": "2026-11-07T20:53:51-08:00",
    });
  });

  it("refuses a release with a setting missing", () => {
    assert.throws(
      () => releaseCompose(config, { ...release, source: "" }),
      /needs its source/,
    );
  });

  it("reads the configuration on standard input and writes the release's", () => {
    const result = spawnSync(
      process.execPath,
      [
        script,
        ...Object.entries(release).flatMap(([key, value]) => [
          `--${key}`,
          value,
        ]),
      ],
      { input: JSON.stringify(config), encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      JSON.parse(result.stdout).services.app.image,
      "registry.example.com/team/fathom-app:0.1.0",
    );
  });
});
