// SPDX-License-Identifier: Apache-2.0

// Checks the production Compose file's settings: deploy/compose.env.example lists every setting it
// reads on the host, and no others, only the proxy publishes a port or has a route out, and the
// database's network is shared only with the application and the migration run. The running
// containers are tested by 'pnpm test:containers'.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const read = (path) =>
  readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const names = (text, pattern) =>
  new Set([...text.matchAll(pattern)].map((match) => match[1]));

const { services, networks } = JSON.parse(
  execFileSync(
    "docker",
    [
      "compose",
      "--file",
      fileURLToPath(new URL("../deploy/compose.yaml", import.meta.url)),
      "config",
      "--format",
      "json",
    ],
    { encoding: "utf8" },
  ),
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
