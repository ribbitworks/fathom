// SPDX-License-Identifier: Apache-2.0

// Lets a security report reuse an earlier report's Trivy result when nothing the scan reads has
// changed, recording each scan's inputs, or that it was skipped, in the report's scans.json.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseReportTime } from "./prune-reports.mjs";
import { skipReasons, scans as summaryScans } from "./security-summary.mjs";

export const scansFile = "scans.json";
export const imagesFile = "container-images.json";
const filesFile = "files.json";

function readJson(path) {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

const filesSummary = summaryScans.find((scan) => scan.file === filesFile);

// How each kind of scan that can be reused finds its earlier result and tells that it completed.
const kinds = new Map([
  [
    filesFile,
    {
      resultIn: (reportDir) => readJson(join(reportDir, filesFile)),
      completed: (result) =>
        result !== undefined &&
        result !== null &&
        filesSummary.completed(result),
    },
  ],
  [
    imagesFile,
    {
      resultIn: (reportDir, image) => {
        const combined = readJson(join(reportDir, imagesFile));
        return Array.isArray(combined)
          ? combined.find((scan) => scan?.image === image)?.report
          : undefined;
      },
      completed: (report) => typeof report?.SchemaVersion === "number",
    },
  ],
]);

function kindOf(scan) {
  const kind = kinds.get(scan.file);
  if (kind === undefined) throw new Error(`${scan.file} cannot be reused`);
  return kind;
}

function sameInputs(a, b) {
  const sorted = (inputs) =>
    JSON.stringify(
      Object.entries(inputs).sort(([first], [second]) =>
        first.localeCompare(second),
      ),
    );
  return (
    Object.keys(a).length > 0 &&
    b !== null &&
    typeof b === "object" &&
    sorted(a) === sorted(b)
  );
}

// Every input must have a value; one that could not be found, such as a missing database
// version, means the scan cannot be matched and runs in full.
export function parseInputs(pairs) {
  const inputs = {};
  for (const pair of pairs) {
    const separator = pair.indexOf("=");
    if (separator < 1) throw new Error(`An input must be name=value: ${pair}`);
    inputs[pair.slice(0, separator)] = pair.slice(separator + 1);
  }
  return inputs;
}

function hasEveryValue(inputs) {
  const values = Object.values(inputs);
  return values.length > 0 && values.every((value) => value !== "");
}

export function scansIn(reportDir) {
  const recorded = readJson(join(reportDir, scansFile));
  return Array.isArray(recorded) ? recorded : [];
}

function addScan(reportDir, entry) {
  writeFileSync(
    join(reportDir, scansFile),
    `${JSON.stringify([...scansIn(reportDir), entry], null, 2)}\n`,
  );
}

// Earlier report folders, newest first.
function earlierReports(reportDir) {
  const outputDir = dirname(reportDir);
  const current = basename(reportDir);
  return readdirSync(outputDir)
    .filter((name) => name !== current && parseReportTime(name) !== undefined)
    .sort()
    .reverse()
    .map((name) => join(outputDir, name));
}

// The earlier result of this scan with these inputs, and the report it came from.
export function findEarlier(reportDir, scan, inputs) {
  const kind = kindOf(scan);
  if (!hasEveryValue(inputs)) return undefined;
  for (const earlier of earlierReports(reportDir)) {
    for (const entry of scansIn(earlier)) {
      if (entry?.file !== scan.file || entry.image !== scan.image) continue;
      if (!sameInputs(inputs, entry.inputs)) continue;
      const result = kind.resultIn(earlier, scan.image);
      if (kind.completed(result)) return { result, from: basename(earlier) };
    }
  }
  return undefined;
}

// Records that the result was reused, once it has been written into the new report.
export function recordReuse(reportDir, scan, inputs, from) {
  addScan(reportDir, { ...scan, inputs, reusedFrom: from });
}

// Records a fresh scan's inputs, only once it has completed, so a failed scan is never reused.
export function record(reportDir, scan, inputs, result) {
  if (!kindOf(scan).completed(result) || !hasEveryValue(inputs)) return false;
  addScan(reportDir, { ...scan, inputs });
  return true;
}

// Records that a scan was skipped, since nothing that decides its result changed against
// origin/main or since the report ran offline, so the summary shows it as skipped rather than as
// not completed. Only the scans the summary allows for that reason may be skipped.
export function recordSkip(reportDir, file, why = "unchanged") {
  const allowed = skipReasons.get(why);
  if (allowed === undefined)
    throw new Error(
      `A scan is skipped only as ${[...skipReasons.keys()].join(" or ")}`,
    );
  if (!allowed.files.includes(file))
    throw new Error(
      `Only ${allowed.files.join(" or ")} may be skipped as ${why}`,
    );
  addScan(reportDir, { file, skipped: why });
}

function reuseCommand(reportDir, scan, pairs, write) {
  const inputs = parseInputs(pairs);
  const earlier = findEarlier(reportDir, scan, inputs);
  if (earlier === undefined) return 1;
  write(earlier.result);
  recordReuse(reportDir, scan, inputs, earlier.from);
  return 0;
}

function main([command, reportDir, ...rest]) {
  if (command === "reuse" && rest[0] === filesFile)
    return reuseCommand(
      reportDir,
      { file: filesFile },
      rest.slice(1),
      (result) =>
        writeFileSync(
          join(reportDir, filesFile),
          `${JSON.stringify(result)}\n`,
        ),
    );
  if (command === "reuse-image" && rest.length >= 1)
    return reuseCommand(
      reportDir,
      { file: imagesFile, image: rest[0] },
      rest.slice(1),
      (result) => process.stdout.write(`${JSON.stringify(result)}\n`),
    );
  if (command === "record" && rest[0] === filesFile) {
    record(
      reportDir,
      { file: filesFile },
      parseInputs(rest.slice(1)),
      readJson(join(reportDir, filesFile)),
    );
    return 0;
  }
  if (command === "record-image" && rest.length >= 2) {
    record(
      reportDir,
      { file: imagesFile, image: rest[0] },
      parseInputs(rest.slice(2)),
      readJson(rest[1]),
    );
    return 0;
  }
  if (command === "record-skip" && [1, 2].includes(rest.length)) {
    recordSkip(reportDir, rest[0], rest[1]);
    return 0;
  }
  console.error(
    "Usage: node scripts/scan-reuse.mjs reuse|record <report folder> files.json <name>=<value> ..., reuse-image <report folder> <image> <name>=<value> ..., record-image <report folder> <image> <report file> <name>=<value> ..., or record-skip <report folder> <scan file> [unchanged|offline]",
  );
  return 2;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  try {
    process.exitCode = main(process.argv.slice(2));
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exitCode = 2;
  }
}
