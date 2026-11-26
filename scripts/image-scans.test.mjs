// SPDX-License-Identifier: Apache-2.0

// Tests of building and scanning the container images, as scripts/lib.sh's build_compose_images,
// scan_compose_images and hold_trivy_cache do, and of the daily scan, scripts/scan-images.sh, with
// a stand-in for docker on the path that logs what it is asked to do: each image is scanned once,
// anything not pulled, built, listed or scanned counts as not scanned, an unchanged image's scan is
// reused, only one scan at a time holds a copy's Trivy cache, and the daily scan pulls the newest
// full release's images, or says there is no release yet.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repositoryRoot = fileURLToPath(new URL("..", import.meta.url));

// Stands in for docker: Compose lists fictional images for each file, saving writes a tar with a
// manifest naming a configuration made from the image's name, and Trivy reports no findings.
const stubDocker = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >>"$STUB_LOG"
case " $* " in
  " info " | *" ps "*) ;;
  *" compose "*)
    case " $* " in
      *" --format json "*)
        [[ "\${STUB_FAIL_RELEASE_LIST:-}" != yes ]] || exit 1
        printf '{"services":{"app":{"image":"fathom-app:latest","build":{"context":"."}},"migrate":{"image":"fathom-app:latest","build":{"context":"."}},"proxy":{"image":"fathom-proxy:latest","build":{"context":"."}}}}\\n'
        ;;
      *" pull "*) [[ " $* " != *"$STUB_FAIL_PULL"* ]] ;;
      *" build "*)
        printf 'build registry=%s\\n' "\${FATHOM_REGISTRY-unset}" >>"$STUB_LOG"
        [[ " $* " != *"$STUB_FAIL_BUILD"* ]] ;;
      *" config "*)
        case " $* " in
          *compose.dev.yaml*) printf 'example/postgres:scan\\n' ;;
          *) printf 'example/postgres:scan\\nexample/app:scan\\nexample/app:scan\\nexample/proxy:scan\\n' ;;
        esac
        ;;
    esac
    ;;
  *" save "*)
    output="" image=""
    while [ "$#" -gt 0 ]; do
      case "$1" in
        --output) output="$2"; shift ;;
        save | --platform | linux/amd64) ;;
        *) image="$1" ;;
      esac
      shift
    done
    [[ "$image" != "$STUB_FAIL_SAVE" ]] || exit 1
    folder="$(mktemp -d)"
    digest="$(printf '%s' "$image" | shasum -a 256 | cut -c1-64)"
    printf '[{"Config":"blobs/sha256/%s"}]' "$digest" >"$folder/manifest.json"
    tar -cf "$output" -C "$folder" manifest.json
    rm -rf "$folder"
    ;;
  *" pull "*) [[ " $* " != *"\${STUB_FAIL_PULL_IMAGE:-none}"* ]] ;;
  *" --download-db-only "*) ;;
  *" version --format json "*) printf '{"VulnerabilityDB":{"UpdatedAt":"2026-11-07T18:32:58Z"}}\\n' ;;
  *" --input /image.tar"*) printf '{"SchemaVersion":2,"Results":[]}\\n' ;;
  *) exit 1 ;;
esac
`;

let work;
let bin;
let log;

function bash(script, environment = {}) {
  return spawnSync("bash", ["-c", `source scripts/lib.sh && ${script}`], {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      PATH: `${bin}:${process.env.PATH ?? ""}`,
      STUB_LOG: log,
      STUB_FAIL_PULL: "none",
      STUB_FAIL_BUILD: "none",
      STUB_FAIL_SAVE: "none",
      ...environment,
    },
  });
}

function logged(pattern) {
  return readFileSync(log, "utf8")
    .split("\n")
    .filter((line) => pattern.test(line));
}

function newReport(name) {
  const folder = join(work, "output", name);
  mkdirSync(folder, { recursive: true });
  return folder;
}

function scanned(reportDir) {
  return JSON.parse(
    readFileSync(join(reportDir, "container-images.json"), "utf8"),
  ).map((scan) => [
    scan.image,
    scan.report === null ? "not scanned" : "scanned",
  ]);
}

beforeEach(() => {
  work = mkdtempSync(join(tmpdir(), "fathom-image-scans-"));
  bin = join(work, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "docker"), stubDocker);
  chmodSync(join(bin, "docker"), 0o755);
  log = join(work, "docker.log");
  writeFileSync(log, "");
});

afterEach(() => {
  rmSync(work, { recursive: true, force: true });
});

describe("building and scanning the container images", () => {
  it("scans each image once, however many services or Compose files name it", () => {
    const images = join(work, "images");
    const reportDir = newReport("2026-11-07T10-00-00Z");
    const result = bash(
      `build_compose_images '${images}' && scan_compose_images '${images}' '${reportDir}' 2026-11-07T00:00:00Z`,
    );
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(scanned(reportDir), [
      ["example/postgres:scan", "scanned"],
      ["example/app:scan", "scanned"],
      ["example/proxy:scan", "scanned"],
    ]);
    assert.equal(logged(/ --input \/image\.tar/).length, 3);
  });

  it("counts what could not be pulled, built or saved as not scanned", () => {
    for (const [environment, expected] of [
      [
        { STUB_FAIL_PULL: "compose.dev.yaml" },
        ["images pulled by deploy/compose.dev.yaml", "not scanned"],
      ],
      [
        { STUB_FAIL_BUILD: "compose.yaml --profile" },
        ["images built by deploy/compose.yaml", "not scanned"],
      ],
      [
        { STUB_FAIL_SAVE: "example/app:scan" },
        ["example/app:scan", "not scanned"],
      ],
    ]) {
      const images = mkdtempSync(join(work, "images-"));
      const reportDir = newReport("2026-11-07T10-00-00Z");
      const result = bash(
        `build_compose_images '${images}' && scan_compose_images '${images}' '${reportDir}' 2026-11-07T00:00:00Z`,
        environment,
      );
      assert.equal(result.status, 0, result.stderr);
      assert.ok(
        scanned(reportDir).some(
          ([image, state]) => image === expected[0] && state === expected[1],
        ),
        JSON.stringify(scanned(reportDir)),
      );
      rmSync(reportDir, { recursive: true });
    }
  });

  it("counts every image as not scanned without Trivy's database", () => {
    const images = join(work, "images");
    const reportDir = newReport("2026-11-07T10-00-00Z");
    bash(
      `build_compose_images '${images}' && scan_compose_images '${images}' '${reportDir}' ''`,
    );
    assert.deepEqual(
      scanned(reportDir).map(([, state]) => state),
      ["not scanned", "not scanned", "not scanned"],
    );
    assert.equal(logged(/ save /).length, 0);
  });

  it("counts images as not scanned when their build stopped part way", () => {
    const images = join(work, "images");
    mkdirSync(images);
    writeFileSync(join(images, "images.list"), "image|example/postgres:scan\n");
    const reportDir = newReport("2026-11-07T10-00-00Z");
    bash(`scan_compose_images '${images}' '${reportDir}' 2026-11-07T00:00:00Z`);
    assert.deepEqual(scanned(reportDir), [
      ["images that were not all built", "not scanned"],
      ["example/postgres:scan", "scanned"],
    ]);
  });

  it("reuses an earlier report's scan of an image that has not changed", () => {
    const first = join(work, "first");
    const second = join(work, "second");
    const earlier = newReport("2026-11-07T10-00-00Z");
    const later = newReport("2026-11-07T11-00-00Z");
    bash(
      `build_compose_images '${first}' && scan_compose_images '${first}' '${earlier}' 2026-11-07T00:00:00Z`,
    );
    writeFileSync(log, "");
    bash(
      `build_compose_images '${second}' && scan_compose_images '${second}' '${later}' 2026-11-07T00:00:00Z`,
    );
    assert.equal(logged(/ --input \/image\.tar/).length, 0);
    assert.deepEqual(
      JSON.parse(readFileSync(join(later, "scans.json"), "utf8")).map(
        (entry) => entry.reusedFrom,
      ),
      ["2026-11-07T10-00-00Z", "2026-11-07T10-00-00Z", "2026-11-07T10-00-00Z"],
    );
  });
});

describe("holding a copy's Trivy cache", () => {
  it("refuses a second scan while the first's process runs, and takes over an ended one's", () => {
    // A lock of the test's own, since a real scan in this copy may hold the copy's.
    const lock = join(work, "trivy-cache.lock");
    const holding = (script) =>
      bash(`fathom_trivy_lock='${lock}' && ${script}`);
    mkdirSync(lock);
    writeFileSync(join(lock, "process"), `${String(process.pid)}\n`);
    const refused = holding("hold_trivy_cache");
    assert.equal(refused.status, 1);
    assert.ok(refused.stderr.includes(`process ${String(process.pid)}`));

    writeFileSync(join(lock, "process"), "99999999\n");
    const taken = holding(
      "hold_trivy_cache && release_trivy_cache && echo released",
    );
    assert.equal(taken.status, 0, taken.stderr);
    assert.equal(taken.stdout.trim().split("\n").pop(), "released");
    assert.equal(existsSync(lock), false);
  });
});

describe("the daily image scan", () => {
  let repository;

  function git(...args) {
    const result = spawnSync("git", args, {
      cwd: repository,
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr);
  }

  function scanImages(environment = {}) {
    return spawnSync("bash", ["scripts/scan-images.sh"], {
      cwd: repository,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH ?? ""}`,
        STUB_LOG: log,
        STUB_FAIL_PULL: "none",
        STUB_FAIL_BUILD: "none",
        STUB_FAIL_SAVE: "none",
        FATHOM_REGISTRY: "registry.example.test/team",
        ...environment,
      },
    });
  }

  function scannedImages() {
    const output = join(repository, "output/security");
    const [report] = readdirSync(output).filter((name) => name.endsWith("Z"));
    return scanned(join(output, report));
  }

  beforeEach(() => {
    repository = join(work, "repository");
    for (const path of ["scripts", "deploy", ".trivyignore.yaml"])
      cpSync(join(repositoryRoot, path), join(repository, path), {
        recursive: true,
        filter: (source) => !source.includes("container-tests"),
      });
    git("init", "--quiet");
    git("config", "user.email", "tester@example.test");
    git("config", "user.name", "Fictional Tester");
    git("add", ".");
    git("commit", "--quiet", "-m", "start");
  });

  it("builds the images under local names, never the registry's, though it is set", () => {
    const result = scanImages();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    const builds = logged(/^build registry=/);
    assert.ok(builds.length > 0);
    assert.deepEqual([...new Set(builds)], ["build registry="]);
  });

  it("scans the built images only, saying so, before the first release", () => {
    const result = scanImages();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.match(result.stdout, /No release has been made yet/);
    assert.deepEqual(
      scannedImages().map(([image]) => image),
      ["example/postgres:scan", "example/app:scan", "example/proxy:scan"],
    );
  });

  it("pulls and scans the newest full release's images, leaving out a newer pre-release", () => {
    for (const tag of ["v0.1.0", "v0.2.0", "v0.3.0-rc.1"]) git("tag", tag);
    const result = scanImages();
    assert.equal(result.status, 0, result.stdout + result.stderr);
    assert.deepEqual(logged(/^pull /), [
      "pull --quiet --platform linux/amd64 registry.example.test/team/fathom-app:0.2.0",
      "pull --quiet --platform linux/amd64 registry.example.test/team/fathom-proxy:0.2.0",
    ]);
    assert.deepEqual(scannedImages().slice(3), [
      ["registry.example.test/team/fathom-app:0.2.0", "scanned"],
      ["registry.example.test/team/fathom-proxy:0.2.0", "scanned"],
    ]);
  });

  it("fails when a release image cannot be pulled", () => {
    git("tag", "v0.1.0");
    const result = scanImages({ STUB_FAIL_PULL_IMAGE: "fathom-proxy:0.1.0" });
    assert.notEqual(result.status, 0);
    assert.ok(
      scannedImages().some(
        ([image, state]) =>
          image ===
            "registry.example.test/team/fathom-proxy:0.1.0, which could not be pulled" &&
          state === "not scanned",
      ),
    );
  });

  it("fails when the release's images cannot be listed", () => {
    git("tag", "v0.1.0");
    const result = scanImages({ STUB_FAIL_RELEASE_LIST: "yes" });
    assert.notEqual(result.status, 0);
    assert.ok(
      scannedImages().some(
        ([image, state]) =>
          image === "images of v0.1.0" && state === "not scanned",
      ),
    );
  });
});
