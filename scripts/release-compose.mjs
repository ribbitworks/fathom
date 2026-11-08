// SPDX-License-Identifier: Apache-2.0

// Turns a release tag's Compose configuration, as 'docker compose config --format json' prints it,
// into the one scripts/publish-images.sh builds: each built image named for the registry and the
// version, labelled with its source, licence, version, commit and date, and dated by the commit.
// With --images, prints only the names of the images a release publishes, one a line, as the daily
// image scan pulls them.
// Usage: docker compose config --format json | node scripts/release-compose.mjs --registry <registry>
//   --version <version> --revision <commit> --epoch <seconds> --created <time> --source <address>
//   docker compose config --format json | node scripts/release-compose.mjs --images
//   --registry <registry> --version <version>

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

function releaseImage(registry, service, name, version) {
  return `${registry.replace(/\/+$/, "")}/${imageName(service.image ?? name)}:${version}`;
}

// The images a release publishes: one for each service built from the repository.
export function releaseImages(config, registry, version) {
  if (!registry || !version)
    throw new Error("The release's images need its registry and version");
  return [
    ...new Set(
      Object.entries(config.services ?? {})
        .filter(([, service]) => service.build)
        .map(([name, service]) =>
          releaseImage(registry, service, name, version),
        ),
    ),
  ].sort();
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
          image: releaseImage(registry, service, name, release.version),
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
      options: {
        ...Object.fromEntries(
          settings.map((setting) => [setting, { type: "string" }]),
        ),
        images: { type: "boolean" },
      },
    });
    const config = JSON.parse(readFileSync(0, "utf8"));
    process.stdout.write(
      values.images
        ? `${releaseImages(config, values.registry, values.version).join("\n")}\n`
        : `${JSON.stringify(releaseCompose(config, values), null, 2)}\n`,
    );
  } catch (error) {
    console.error(`error: ${error.message}`);
    process.exit(2);
  }
}
