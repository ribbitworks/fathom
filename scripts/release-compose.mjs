// SPDX-License-Identifier: Apache-2.0

// Turns a release tag's Compose configuration, as 'docker compose config --format json' prints it,
// into the one scripts/publish-images.sh builds: each built image named for the registry and the
// version, labelled with its source, licence, version, commit and date, and dated by the commit.
// Usage: docker compose config --format json | node scripts/release-compose.mjs --registry <registry>
//   --version <version> --revision <commit> --epoch <seconds> --created <time> --source <address>

import { readFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

const settings = [
  "registry",
  "version",
  "revision",
  "epoch",
  "created",
  "source",
];

// The image's own name, such as fathom-app for fathom-app:latest or example.com/team/fathom-app.
function imageName(image) {
  return image
    .replace(/:[^/]*$/, "")
    .split("/")
    .pop();
}

export function releaseCompose(config, release) {
  const given = new Map(Object.entries(release));
  for (const setting of settings)
    if (!given.get(setting))
      throw new Error(`The release needs its ${setting}`);
  const registry = release.registry.replace(/\/+$/, "");
  const services = Object.fromEntries(
    Object.entries(config.services ?? {}).map(([name, service]) => {
      if (!service.build) return [name, service];
      return [
        name,
        {
          ...service,
          image: `${registry}/${imageName(service.image ?? name)}:${release.version}`,
          build: {
            ...service.build,
            args: { ...service.build.args, SOURCE_DATE_EPOCH: release.epoch },
            labels: {
              ...service.build.labels,
              "org.opencontainers.image.source": release.source,
              "org.opencontainers.image.licenses": "Apache-2.0",
              "org.opencontainers.image.version": release.version,
              "org.opencontainers.image.revision": release.revision,
              "org.opencontainers.image.created": release.created,
            },
          },
        },
      ];
    }),
  );
  return { ...config, services };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    const { values } = parseArgs({
      options: Object.fromEntries(
        settings.map((setting) => [setting, { type: "string" }]),
      ),
    });
    const config = JSON.parse(readFileSync(0, "utf8"));
    process.stdout.write(
      `${JSON.stringify(releaseCompose(config, values), null, 2)}\n`,
    );
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(2);
  }
}
