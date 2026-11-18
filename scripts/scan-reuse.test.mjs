// SPDX-License-Identifier: Apache-2.0

// Tests of reusing an earlier security report's Trivy results, recording each scan's inputs, and
// recording skipped scans.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import {
  findEarlier,
  parseInputs,
  record,
  recordReuse,
  recordSkip,
  scansIn,
} from "./scan-reuse.mjs";

const script = fileURLToPath(new URL("scan-reuse.mjs", import.meta.url));

// Finds an earlier result and records its reuse, as the commands do once they have written it.
function reuse(reportDir, scan, inputs) {
  const earlier = findEarlier(reportDir, scan, inputs);
  if (earlier === undefined) return undefined;
  recordReuse(reportDir, scan, inputs, earlier.from);
  return earlier.result;
}

function pairs(values) {
  return Object.entries(values).map(([key, value]) => `${key}=${value}`);
}

function command(...args) {
  return spawnSync("node", [script, ...args], { encoding: "utf8" });
}

const inputs = {
  "dependency-files": "a1",
  exceptions: "b2",
  database: "2026-11-07T18:32:58Z",
  day: "2026-11-07",
};
const completeFiles = {
  Results: [{ Target: "pnpm-lock.yaml", Class: "lang-pkgs" }],
};
const filesScan = { file: "files.json" };
const image = "example/app:scan";
const imageScan = { file: "container-images.json", image };
const imageReport = { SchemaVersion: 2, Results: [] };

let outputDir;

function report(name, files = {}) {
  const folder = join(outputDir, name);
  mkdirSync(folder, { recursive: true });
  for (const [file, contents] of Object.entries(files))
    writeFileSync(join(folder, file), JSON.stringify(contents));
  return folder;
}

beforeEach(() => {
  outputDir = mkdtempSync(join(tmpdir(), "fathom-scan-reuse-"));
  // A file beside the report folders, as fix-dates.json is, is not a report.
  writeFileSync(join(outputDir, "fix-dates.json"), "{}");
});

afterEach(() => {
  rmSync(outputDir, { recursive: true, force: true });
});

describe("reusing the dependency scan", () => {
  it("reuses the newest earlier result with the same inputs, and records where it came from", () => {
    // Given two earlier reports with the same inputs
    report("2026-11-07T10-00-00Z", {
      "files.json": { ...completeFiles, from: "older" },
      "scans.json": [{ ...filesScan, inputs }],
    });
    report("2026-11-07T11-00-00Z", {
      "files.json": { ...completeFiles, from: "newer" },
      "scans.json": [{ ...filesScan, inputs }],
    });
    const current = report("2026-11-07T12-00-00Z");

    // When the new report asks
    const result = reuse(current, filesScan, { ...inputs });

    // Then it gets the newer result, and records the reuse
    assert.equal(result.from, "newer");
    assert.deepEqual(scansIn(current), [
      { ...filesScan, inputs, reusedFrom: "2026-11-07T11-00-00Z" },
    ]);
  });

  it("reuses nothing when any input differs, is missing, or is added", () => {
    report("2026-11-07T10-00-00Z", {
      "files.json": completeFiles,
      "scans.json": [{ ...filesScan, inputs }],
    });
    const current = report("2026-11-07T12-00-00Z");
    for (const changed of [
      { ...inputs, database: "2026-11-08T18:32:58Z" },
      { "dependency-files": "a1", exceptions: "b2" },
      { ...inputs, settings: "--scanners vuln" },
      { ...inputs, day: "2026-11-08" },
    ]) {
      assert.equal(reuse(current, filesScan, changed), undefined);
    }
    assert.deepEqual(scansIn(current), []);
  });

  it("reuses nothing when an input has no value", () => {
    const empty = { ...inputs, database: "" };
    report("2026-11-07T10-00-00Z", {
      "files.json": completeFiles,
      "scans.json": [{ ...filesScan, inputs: empty }],
    });
    const current = report("2026-11-07T12-00-00Z");
    assert.equal(reuse(current, filesScan, empty), undefined);
  });

  it("reuses nothing from a scan that did not complete", () => {
    report("2026-11-07T10-00-00Z", {
      "files.json": { Results: [] },
      "scans.json": [{ ...filesScan, inputs }],
    });
    const current = report("2026-11-07T12-00-00Z");
    assert.equal(reuse(current, filesScan, inputs), undefined);
  });

  it("records a fresh scan's inputs only once it completed", () => {
    const current = report("2026-11-07T12-00-00Z");
    assert.equal(record(current, filesScan, inputs, { Results: [] }), false);
    assert.equal(record(current, filesScan, inputs, undefined), false);
    assert.deepEqual(scansIn(current), []);
    assert.equal(record(current, filesScan, inputs, completeFiles), true);
    assert.deepEqual(scansIn(current), [{ ...filesScan, inputs }]);
  });
});

describe("reusing an image scan", () => {
  it("reuses the earlier report of the same image with the same inputs", () => {
    report("2026-11-07T10-00-00Z", {
      "container-images.json": [
        {
          image: "example/other:scan",
          report: { SchemaVersion: 2, other: true },
        },
        { image, report: imageReport },
      ],
      "scans.json": [{ ...imageScan, inputs }],
    });
    const current = report("2026-11-07T12-00-00Z");
    assert.deepEqual(reuse(current, imageScan, inputs), imageReport);
    assert.equal(
      reuse(current, { ...imageScan, image: "example/other:scan" }, inputs),
      undefined,
    );
  });

  it("reuses nothing when the earlier scan of the image did not complete", () => {
    report("2026-11-07T10-00-00Z", {
      "container-images.json": [{ image, report: null }],
      "scans.json": [{ ...imageScan, inputs }],
    });
    const current = report("2026-11-07T12-00-00Z");
    assert.equal(reuse(current, imageScan, inputs), undefined);
    assert.equal(record(current, imageScan, inputs, null), false);
  });
});

describe("the command", () => {
  it("writes the reused files.json into the new report, or exits 1 when there is none", () => {
    const current = report("2026-11-07T12-00-00Z");
    const missing = command("reuse", current, "files.json", ...pairs(inputs));
    assert.equal(missing.status, 1);
    assert.equal(existsSync(join(current, "files.json")), false);

    report("2026-11-07T10-00-00Z", {
      "files.json": completeFiles,
      "scans.json": [{ ...filesScan, inputs }],
    });
    const found = command("reuse", current, "files.json", ...pairs(inputs));
    assert.equal(found.status, 0);
    assert.deepEqual(
      JSON.parse(readFileSync(join(current, "files.json"), "utf8")),
      completeFiles,
    );
  });

  it("prints a reused image report and records where it came from", () => {
    report("2026-11-07T10-00-00Z", {
      "container-images.json": [{ image, report: imageReport }],
      "scans.json": [{ ...imageScan, inputs }],
    });
    const current = report("2026-11-07T12-00-00Z");
    const found = command("reuse-image", current, image, ...pairs(inputs));
    assert.equal(found.status, 0);
    assert.deepEqual(JSON.parse(found.stdout), imageReport);
    assert.equal(scansIn(current)[0].reusedFrom, "2026-11-07T10-00-00Z");
    assert.equal(
      command("reuse-image", current, "example/other:scan", ...pairs(inputs))
        .status,
      1,
    );
  });

  it("records a fresh image scan only when its report completed", () => {
    const current = report("2026-11-07T12-00-00Z");
    const fresh = join(outputDir, "fresh.json");
    writeFileSync(fresh, "not json");
    assert.equal(
      command("record-image", current, image, fresh, ...pairs(inputs)).status,
      0,
    );
    assert.deepEqual(scansIn(current), []);
    writeFileSync(fresh, JSON.stringify(imageReport));
    command("record-image", current, image, fresh, ...pairs(inputs));
    assert.deepEqual(scansIn(current), [{ ...imageScan, inputs }]);
  });

  it("refuses an input that is not a name and a value", () => {
    assert.throws(() => parseInputs(["database"]), /name=value/);
    assert.throws(() => parseInputs(["=value"]), /name=value/);
    assert.deepEqual(parseInputs(["settings=--scanners a=b"]), {
      settings: "--scanners a=b",
    });
  });
});

describe("skipping a scan", () => {
  it("records that the image scan was skipped, and refuses to skip any other", () => {
    const current = report("2026-11-07T12-00-00Z");
    recordSkip(current, "container-images.json");
    assert.deepEqual(scansIn(current), [
      { file: "container-images.json", skipped: "unchanged" },
    ]);
    assert.throws(
      () => recordSkip(current, "code.json"),
      /Only container-images\.json may be skipped as unchanged/,
    );
  });

  it("records the scans that need the internet as skipped offline, and refuses any other", () => {
    const current = report("2026-11-07T12-00-00Z");
    recordSkip(current, "dependencies.json", "offline");
    recordSkip(current, "container-images.json", "offline");
    assert.deepEqual(scansIn(current), [
      { file: "dependencies.json", skipped: "offline" },
      { file: "container-images.json", skipped: "offline" },
    ]);
    assert.throws(
      () => recordSkip(current, "code.json", "offline"),
      /Only dependencies\.json or container-images\.json may be skipped as offline/,
    );
  });

  it("refuses a reason it does not know", () => {
    const current = report("2026-11-07T12-00-00Z");
    assert.throws(
      () => recordSkip(current, "container-images.json", "tired"),
      /A scan is skipped only as unchanged or offline/,
    );
  });
});
