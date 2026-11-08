// SPDX-License-Identifier: Apache-2.0

// Tests of the Compose configuration a release's images are built from, and of the names of the
// images a release publishes, which the daily image scan pulls.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { releaseCompose, releaseImages } from "./release-compose.mjs";

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

describe("releaseImages", () => {
  it("names each image the release builds once, as releaseCompose names it", () => {
    const withMigration = {
      services: {
        ...config.services,
        migrate: { image: "fathom-app:latest", build: { context: "/src" } },
      },
    };
    const names = releaseImages(withMigration, release.registry, "0.1.0");
    assert.deepEqual(names, [
      "registry.example.com/team/fathom-app:0.1.0",
      "registry.example.com/team/fathom-proxy:0.1.0",
    ]);
    const built = releaseCompose(withMigration, release).services;
    assert.equal(built.app.image, names[0]);
    assert.equal(built.proxy.image, names[1]);
  });

  it("refuses a release with no registry or version", () => {
    assert.throws(
      () => releaseImages(config, "", "0.1.0"),
      /registry and version/,
    );
    assert.throws(
      () => releaseImages(config, "example.com", ""),
      /registry and version/,
    );
  });

  it("prints the names with --images", () => {
    const result = spawnSync(
      process.execPath,
      [
        script,
        "--images",
        "--registry",
        "example.com/team",
        "--version",
        "0.2.0",
      ],
      { input: JSON.stringify(config), encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr);
    assert.equal(
      result.stdout,
      "example.com/team/fathom-app:0.2.0\nexample.com/team/fathom-proxy:0.2.0\n",
    );
  });
});
