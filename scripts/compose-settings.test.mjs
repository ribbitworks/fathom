// SPDX-License-Identifier: Apache-2.0

// Checks the production Compose file's settings: the example lists each it reads, a server runs a
// release's published images, and the networks keep the database apart. The running containers are
// tested by 'pnpm test:containers'.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { devNull } from "node:os";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const names = (text, pattern) =>
  new Set([...text.matchAll(pattern)].map((match) => match[1]));

// The production Compose file as Compose reads it with these settings alone, neither the shell's
// nor a deploy/.env file's.
const configWith = (settings = {}) =>
  JSON.parse(
    execFileSync(
      "docker",
      [
        "compose",
        "--file",
        fileURLToPath(new URL("../deploy/compose.yaml", import.meta.url)),
        "--env-file",
        devNull,
        "config",
        "--format",
        "json",
      ],
      {
        encoding: "utf8",
        env: {
          ...Object.fromEntries(
            Object.entries(process.env).filter(
              ([name]) => !name.startsWith("FATHOM_"),
            ),
          ),
          ...settings,
        },
      },
    ),
  );

const { services, networks } = configWith();
const imagesOf = (config) =>
  Object.fromEntries(
    Object.entries(config.services).map(([name, service]) => [
      name,
      service.image,
    ]),
  );

const servicesWhere = (predicate) =>
  Object.entries(services)
    .filter(([, service]) => predicate(service))
    .map(([name]) => name)
    .sort();

describe("Compose settings", () => {
  it("lists every setting the production Compose file reads, and no others", () => {
    const readByCompose = names(
      read("deploy/compose.yaml"),
      /\$\{(FATHOM_[A-Z_]+)/g,
    );
    const listed = names(
      read("deploy/compose.env.example"),
      /^(FATHOM_[A-Z_]+)=/gm,
    );
    assert.ok(readByCompose.size > 0);
    assert.deepEqual(listed, readByCompose);
  });

  it("runs a release's published images, by its registry and version", () => {
    assert.deepEqual(
      imagesOf(
        configWith({
          FATHOM_REGISTRY: "registry.example.test/team",
          FATHOM_IMAGE_TAG: "0.2.0",
        }),
      ),
      {
        app: "registry.example.test/team/fathom-app:0.2.0",
        migrate: "registry.example.test/team/fathom-app:0.2.0",
        postgres: "registry.example.test/team/fathom-postgres:0.2.0",
        proxy: "registry.example.test/team/fathom-proxy:0.2.0",
      },
    );
  });

  it("names the images built on this machine without a registry", () => {
    assert.deepEqual(imagesOf(configWith()), {
      app: "fathom-app:latest",
      migrate: "fathom-app:latest",
      postgres: "fathom-postgres:latest",
      proxy: "fathom-proxy:latest",
    });
  });

  it("publishes only the proxy's port", () => {
    assert.deepEqual(
      servicesWhere((service) => (service.ports ?? []).length > 0),
      ["proxy"],
    );
  });

  it("leaves only the proxy on a network with a route out", () => {
    const internal = new Map(
      Object.entries(networks).map(([name, network]) => [
        name,
        network.internal === true,
      ]),
    );
    assert.deepEqual(
      servicesWhere((service) =>
        Object.keys(service.networks ?? {}).some(
          (network) => !internal.get(network),
        ),
      ),
      ["proxy"],
    );
  });

  it("shares the database's network only with the application and the migration run", () => {
    const network = Object.keys(services.postgres.networks);
    assert.equal(network.length, 1);
    assert.deepEqual(
      servicesWhere((service) =>
        Object.keys(service.networks ?? {}).includes(network[0]),
      ),
      ["app", "migrate", "postgres"],
    );
  });
});
