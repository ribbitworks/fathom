// SPDX-License-Identifier: Apache-2.0

// Summarizes a security report folder into summary.md. A vulnerability fails the report only once
// its fix is overdue, counted from the fix's release by the Security Plan's fix times; one with no
// fix released is a warning. Any other critical or high finding fails it, as does any scan that
// did not complete. Naming scan files after the report folder summarizes only those scans, as the
// release's image scan does with container-images.json. With --first-seen-unknown-from, a fix
// dated only by a sighting at or after that time counts as having no known release date, so a
// scan on a machine with no earlier reports cannot pass a fix whose release it could not look up.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";
import { parseArgs } from "node:util";
import { firstSeen } from "./fix-dates.mjs";
import { imageInputsDescription } from "./scan-inputs.mjs";
import {
  fixKey,
  vulnerabilitiesIn,
  vulnerabilityScanFiles,
} from "./vulnerabilities.mjs";

export const severities = ["critical", "high", "medium", "low"];

// Days from a fix's release to its due date. A low finding is fixed at the next planned update.
export const fixDays = new Map([
  ["critical", 14],
  ["high", 60],
  ["medium", 180],
]);

const millisecondsPerDay = 24 * 60 * 60 * 1000;

// Semgrep may skip this many characters of a single line, when it does not know newer syntax such
// as a variable named after a new keyword, while the rest of the file is still scanned.
const longestSkippedFragment = 20;

function isSmallFragment(span) {
  const start = span?.start;
  const end = span?.end;
  return (
    Number.isInteger(start?.line) &&
    start.line === end?.line &&
    Number.isInteger(start?.col) &&
    Number.isInteger(end?.col) &&
    end.col >= start.col &&
    end.col - start.col <= longestSkippedFragment
  );
}

function describeSkipped(span, path) {
  const start = span?.start;
  const end = span?.end;
  if (!Number.isInteger(start?.line) || !Number.isInteger(end?.line))
    return `Semgrep skipped part of ${path}, so it was not scanned.`;
  if (start.line === end.line)
    return `Semgrep skipped part of line ${String(start.line)} of ${path}, so it was not scanned.`;
  return `Semgrep skipped lines ${String(start.line)} to ${String(end.line)} of ${path}, so they were not scanned.`;
}

// Everything Semgrep left unscanned. Any error counts, such as a file it could not parse or timed
// out on, unless it only skipped short fragments of single lines, so a kind of error not seen
// before fails the scan rather than passing it.
function scanGaps(results) {
  const gaps = new Set();
  if (!Array.isArray(results.results))
    gaps.add("Semgrep returned no list of results.");
  if (!((results.paths?.scanned?.length ?? 0) > 0))
    gaps.add("Semgrep scanned no files.");
  if (results.errors !== undefined && !Array.isArray(results.errors))
    gaps.add("Semgrep's list of errors could not be read.");
  for (const error of Array.isArray(results.errors) ? results.errors : []) {
    const path =
      typeof error?.path === "string" ? error.path : "an unnamed file";
    const type = Array.isArray(error?.type) ? error.type[0] : error?.type;
    const spans = Array.isArray(error?.type) ? error.type[1] : undefined;
    if (type === "PartialParsing" && Array.isArray(spans) && spans.length > 0) {
      for (const span of spans)
        if (!isSmallFragment(span)) gaps.add(describeSkipped(span, path));
    } else if (
      typeof type === "string" &&
      /\b(syntax|lexical) error\b/i.test(type)
    ) {
      gaps.add(`Semgrep could not parse ${path}, so it was not scanned.`);
    } else {
      gaps.add(
        `Semgrep did not finish ${path} (${typeof type === "string" ? type : "an unknown error"}), so it was not fully scanned.`,
      );
    }
  }
  return [...gaps];
}

const severityAliases = new Map([
  ["critical", "critical"],
  ["high", "high"],
  ["error", "high"],
  ["moderate", "medium"],
  ["medium", "medium"],
  ["warning", "medium"],
  ["unknown", "medium"],
  ["low", "low"],
  ["info", "low"],
]);

function emptyCounts() {
  return new Map(severities.map((severity) => [severity, 0]));
}

// Severities a tool reports that are not recognized count as medium, so they are reviewed.
function normalSeverity(severity) {
  return severityAliases.get(String(severity).toLowerCase()) ?? "medium";
}

function addSeverity(counts, severity, amount = 1) {
  const normalized = normalSeverity(severity);
  counts.set(normalized, counts.get(normalized) + amount);
}

function day(time) {
  return new Date(time).toISOString().slice(0, 10);
}

// When a vulnerability's fix was released and when it is due. The earliest release among the fixed
// versions that would replace the installed one starts the clock. A fix with no known release date
// cannot be judged, so it counts as overdue.
function judge(finding, fixDates, now, firstSeenUnknownFrom) {
  const severity = normalSeverity(finding.severity);
  const [earliest] = finding.fixedVersions
    .map((version) =>
      fixDates.get(fixKey(finding.ecosystem, finding.name, version)),
    )
    .map((date) => ({ ...date, time: Date.parse(date?.released) }))
    .filter((date) => !Number.isNaN(date.time))
    .filter(
      (date) =>
        date.source !== firstSeen ||
        firstSeenUnknownFrom === undefined ||
        date.time < firstSeenUnknownFrom.getTime(),
    )
    .sort((a, b) => a.time - b.time);
  const released = earliest?.time;
  const days = fixDays.get(severity);
  if (released === undefined)
    return {
      ...finding,
      severity,
      released: undefined,
      due: undefined,
      overdue: true,
    };
  const due =
    days === undefined ? undefined : day(released + days * millisecondsPerDay);
  return {
    ...finding,
    severity,
    released: day(released),
    source: earliest.source,
    due,
    overdue: due !== undefined && day(now) > due,
  };
}

export const scans = [
  {
    name: "Dependency vulnerabilities",
    tool: "pnpm audit",
    file: "dependencies.json",
    // pnpm audit's totals must be matched by advisories, or findings would pass unread.
    completed: (results) =>
      typeof results.metadata?.vulnerabilities === "object" &&
      typeof results.advisories === "object" &&
      results.advisories !== null &&
      (Object.keys(results.advisories).length > 0 ||
        Object.values(results.metadata.vulnerabilities).every(
          (total) => total === 0,
        )),
    whyIncomplete: () => [
      "pnpm audit counted vulnerabilities but listed no advisories.",
    ],
    count: () => emptyCounts(),
  },
  {
    name: "Secrets in files",
    tool: "Gitleaks",
    file: "secrets-files.json",
    completed: (results) => Array.isArray(results),
    count: (results) => new Map([...emptyCounts(), ["high", results.length]]),
  },
  {
    name: "Secrets in git history",
    tool: "Gitleaks",
    file: "secrets-history.json",
    completed: (results) => Array.isArray(results),
    count: (results) => new Map([...emptyCounts(), ["high", results.length]]),
  },
  {
    name: "Code security flaws",
    tool: "Semgrep",
    file: "code.json",
    completed: (results) => scanGaps(results).length === 0,
    count(results) {
      const counts = emptyCounts();
      for (const finding of results.results)
        addSeverity(counts, finding.extra?.severity);
      return counts;
    },
    whyIncomplete: scanGaps,
    notes: (results) =>
      results.errors?.length
        ? [
            `Semgrep reported ${String(results.errors.length)} errors; see code.json.`,
          ]
        : [],
  },
  {
    name: "Dependency vulnerabilities and licences",
    tool: "Trivy",
    file: "files.json",
    // The dependency lockfile must have been read, or the vulnerability scan saw nothing.
    completed: (results) =>
      Array.isArray(results.Results) &&
      results.Results.some(
        (target) =>
          target.Class === "lang-pkgs" && target.Target === "pnpm-lock.yaml",
      ),
    count(results) {
      const counts = emptyCounts();
      for (const target of results.Results) {
        // Trivy lists every package's licence; permissive licences are not findings.
        for (const licence of target.Licenses ?? []) {
          if (licence.Severity !== "LOW") addSeverity(counts, licence.Severity);
        }
      }
      return counts;
    },
  },
  {
    name: "Container images",
    tool: "Trivy",
    file: "container-images.json",
    // Every image must have been scanned, and there must be at least one.
    completed: (results) =>
      Array.isArray(results) &&
      results.length > 0 &&
      results.every((scan) => typeof scan.report?.SchemaVersion === "number"),
    count(results) {
      const counts = emptyCounts();
      for (const scan of results) {
        for (const target of scan.report.Results ?? []) {
          // Any secret built into an image is serious, whatever severity Trivy gives it.
          counts.set(
            "high",
            counts.get("high") + (target.Secrets ?? []).length,
          );
        }
      }
      return counts;
    },
    notes: (results) => [
      `Images scanned: ${results.map((scan) => scan.image).join(", ")}.`,
    ],
  },
  {
    name: "Configuration",
    tool: "Trivy",
    file: "configuration.json",
    // A project may have no configuration files Trivy checks, so any well-formed Trivy report counts.
    completed: (results) => typeof results.SchemaVersion === "number",
    count(results) {
      const counts = emptyCounts();
      for (const target of results.Results ?? []) {
        for (const misconfiguration of target.Misconfigurations ?? []) {
          addSeverity(counts, misconfiguration.Severity);
        }
      }
      return counts;
    },
  },
];

// Reads a tool's results and rewrites the file pretty-printed. Returns undefined if the file is
// missing, empty, or not JSON.
export function readResults(reportDir, file) {
  const path = join(reportDir, file);
  if (!existsSync(path)) return undefined;
  const text = readFileSync(path, "utf8").trim();
  if (!text) return undefined;
  let results;
  try {
    results = JSON.parse(text);
  } catch {
    return undefined;
  }
  writeFileSync(path, `${JSON.stringify(results, null, 2)}\n`);
  return results;
}

function findingRow(finding) {
  const fix = finding.fixedVersions.join(", ");
  const due =
    finding.released === undefined
      ? "Unknown release date"
      : (finding.due ?? "Next planned update");
  return `| ${finding.id} | ${finding.name} ${String(finding.installed ?? "")} | ${finding.severity} | ${fix} | ${finding.released ?? ""} | ${finding.source ?? ""} | ${due}${finding.overdue ? " (overdue)" : ""} |`;
}

function plural(count, one, many) {
  return `${String(count)} ${count === 1 ? one : many}`;
}

const fixTimes = [...fixDays]
  .map(([severity, days]) => `${severity} ${String(days)} days`)
  .join(", ");

// A name that is no scan's file is refused, so a mistyped name cannot leave nothing to judge.
export function checkScanFiles(files = []) {
  const unknown = files.filter(
    (file) => !scans.some((scan) => scan.file === file),
  );
  if (unknown.length)
    throw new Error(`Not a scan's file: ${unknown.join(", ")}`);
}

// The scans scripts/scan-reuse.mjs recorded as skipped, since nothing that decides them changed.
// Only the image scan may be skipped, so no other scan can pass by being left out.
function skippedScans(reportDir) {
  const recorded = readResults(reportDir, "scans.json");
  return new Set(
    (Array.isArray(recorded) ? recorded : [])
      .filter(
        (entry) =>
          entry?.file === "container-images.json" &&
          typeof entry.skipped === "string",
      )
      .map((entry) => entry.file),
  );
}

function skippedNote(scan) {
  return `${scan.name} were not built or scanned, since nothing that can change their scan changed against origin/main: ${imageInputsDescription}. The default branch's images and the newest release's are scanned daily, and each release's as it is published.`;
}

// Names each result scripts/scan-reuse.mjs took from an earlier report, and which report.
function reusedNotes(reportDir) {
  const recorded = readResults(reportDir, "scans.json");
  if (!Array.isArray(recorded)) return [];
  return recorded
    .filter((entry) => typeof entry?.reusedFrom === "string")
    .map((entry) =>
      entry.image === undefined
        ? `Trivy's scan of dependencies and licences was reused from run ${entry.reusedFrom}, since the dependency files, the exceptions and Trivy's database are unchanged.`
        : `The scan of ${String(entry.image)} was reused from run ${entry.reusedFrom}, since the image, the exceptions and Trivy's database are unchanged.`,
    );
}

export function summarize(
  reportDir,
  now = new Date(),
  { files, firstSeenUnknownFrom } = {},
) {
  checkScanFiles(files);
  let failed = false;
  const notes = [];
  const fixDatesRead = readResults(reportDir, "fix-dates.json");
  const fixDatesFile =
    fixDatesRead !== null &&
    typeof fixDatesRead === "object" &&
    !Array.isArray(fixDatesRead)
      ? fixDatesRead
      : undefined;
  const fixDates = new Map(Object.entries(fixDatesFile ?? {}));
  const fixable = new Map();
  let unfixed = 0;
  const unfixedSerious = new Set();
  const skipped = skippedScans(reportDir);
  const chosen = files
    ? scans.filter((scan) => files.includes(scan.file))
    : scans;
  const rows = chosen.map((scan) => {
    const results = readResults(reportDir, scan.file);
    if (results === undefined && skipped.has(scan.file)) {
      notes.push(skippedNote(scan));
      return `| ${scan.name} | ${scan.tool} | Skipped | | | | |`;
    }
    if (results === undefined || results === null || !scan.completed(results)) {
      failed = true;
      if (results) notes.push(...(scan.whyIncomplete?.(results) ?? []));
      return `| ${scan.name} | ${scan.tool} | Did not complete | | | | |`;
    }
    const counts = scan.count(results);
    notes.push(...(scan.notes?.(results) ?? []));
    let blocking = counts.get("critical") + counts.get("high") > 0;
    if (vulnerabilityScanFiles.includes(scan.file)) {
      for (const finding of vulnerabilitiesIn(scan.file, results)) {
        addSeverity(counts, finding.severity);
        if (finding.fixedVersions.length === 0) {
          unfixed += 1;
          if (["critical", "high"].includes(normalSeverity(finding.severity)))
            unfixedSerious.add(`${finding.id} in ${finding.name}`);
          continue;
        }
        const judged = judge(finding, fixDates, now, firstSeenUnknownFrom);
        if (judged.overdue) blocking = true;
        fixable.set(
          `${judged.id} ${judged.name} ${String(judged.installed)}`,
          judged,
        );
      }
    }
    if (blocking) failed = true;
    const cells = severities
      .map((severity) => String(counts.get(severity)))
      .join(" | ");
    return `| ${scan.name} | ${scan.tool} | ${blocking ? "Fail" : "Pass"} | ${cells} |`;
  });

  const withFix = [...fixable.values()].sort(
    (a, b) =>
      Number(b.overdue) - Number(a.overdue) ||
      String(a.due ?? "9999").localeCompare(String(b.due ?? "9999")) ||
      a.id.localeCompare(b.id),
  );
  const fixTable = withFix.length
    ? [
        "## Vulnerabilities With a Fix",
        "",
        "| Finding | Package | Severity | Fixed in | Fix released | Dated by | Due |",
        "| --- | --- | --- | --- | --- | --- | --- |",
        ...withFix.map(findingRow),
        "",
      ]
    : [];
  if (unfixed)
    notes.push(
      `${plural(unfixed, "vulnerability has", "vulnerabilities have")} no fix released yet, and ${unfixed === 1 ? "is a warning" : "are warnings"} until one is.`,
    );
  if (unfixedSerious.size)
    notes.push(
      `Critical or high, with no fix released: ${[...unfixedSerious].sort().join(", ")}.`,
    );
  const firstSightings = withFix.filter(
    (finding) => finding.source === "first seen",
  ).length;
  if (firstSightings)
    notes.push(
      `${plural(firstSightings, "fix is", "fixes are")} dated from the first report that saw ${firstSightings === 1 ? "it" : "them"}, since ${firstSightings === 1 ? "its" : "their"} release could not be looked up.`,
    );
  if (withFix.length && fixDatesFile === undefined)
    notes.push(
      "The fixes' release dates could not be found, so every fix counts as overdue.",
    );
  notes.push(...reusedNotes(reportDir));

  const markdown = [
    "# Security Report",
    "",
    `- **Run:** ${basename(reportDir)}`,
    `- **Result:** ${failed ? "Fail" : "Pass"}`,
    "",
    "| Scan | Tool | Result | Critical | High | Medium | Low |",
    "| --- | --- | --- | --- | --- | --- | --- |",
    ...rows,
    "",
    ...notes.map((note) => `- ${note}`),
    ...(notes.length ? [""] : []),
    ...fixTable,
    `The report fails if a vulnerability's fix is overdue, if any other scan finds a critical or high issue, or if a scan does not complete. Fix times, counted from a fix's release: ${fixTimes}, and low at the next planned update. Each tool's full results are in this folder.`,
    "",
  ].join("\n");

  return { failed, markdown };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let reportDir;
  let options;
  try {
    const { values, positionals } = parseArgs({
      allowPositionals: true,
      options: { "first-seen-unknown-from": { type: "string" } },
    });
    const from = values["first-seen-unknown-from"];
    if (
      !positionals[0] ||
      (from !== undefined && Number.isNaN(Date.parse(from)))
    )
      throw new Error("bad arguments");
    reportDir = positionals[0];
    const files = positionals.slice(1);
    options = {
      files: files.length ? files : undefined,
      firstSeenUnknownFrom: from === undefined ? undefined : new Date(from),
    };
    checkScanFiles(options.files);
  } catch (error) {
    console.error(
      error.message.startsWith("Not a scan")
        ? `error: ${error.message}`
        : "Usage: node scripts/security-summary.mjs <report folder> [--first-seen-unknown-from <time>] [scan file ...]",
    );
    process.exit(2);
  }
  const { failed, markdown } = summarize(reportDir, new Date(), options);
  writeFileSync(join(reportDir, "summary.md"), markdown);
  console.log(markdown);
  process.exit(failed ? 1 : 0);
}
