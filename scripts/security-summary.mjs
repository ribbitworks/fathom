// SPDX-License-Identifier: Apache-2.0

// Summarizes a security report folder into summary.md, and fails on critical or high findings
// or on any scan that did not complete.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

export const severities = ["critical", "high", "medium", "low"];

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
function addSeverity(counts, severity, amount = 1) {
  const normalized =
    severityAliases.get(String(severity).toLowerCase()) ?? "medium";
  counts.set(normalized, counts.get(normalized) + amount);
}

export const scans = [
  {
    name: "Dependency vulnerabilities",
    tool: "pnpm audit",
    file: "dependencies.json",
    completed: (results) =>
      typeof results.metadata?.vulnerabilities === "object",
    count(results) {
      const counts = emptyCounts();
      for (const [severity, total] of Object.entries(
        results.metadata.vulnerabilities,
      )) {
        addSeverity(counts, severity, total);
      }
      return counts;
    },
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
        for (const vulnerability of target.Vulnerabilities ?? []) {
          addSeverity(counts, vulnerability.Severity);
        }
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
          for (const vulnerability of target.Vulnerabilities ?? []) {
            addSeverity(counts, vulnerability.Severity);
          }
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

export function summarize(reportDir) {
  let failed = false;
  const notes = [];
  const rows = scans.map((scan) => {
    const results = readResults(reportDir, scan.file);
    if (results === undefined || results === null || !scan.completed(results)) {
      failed = true;
      if (results) notes.push(...(scan.whyIncomplete?.(results) ?? []));
      return `| ${scan.name} | ${scan.tool} | Did not complete | | | | |`;
    }
    const counts = scan.count(results);
    notes.push(...(scan.notes?.(results) ?? []));
    const blocking = counts.get("critical") + counts.get("high") > 0;
    if (blocking) failed = true;
    const cells = severities
      .map((severity) => String(counts.get(severity)))
      .join(" | ");
    return `| ${scan.name} | ${scan.tool} | ${blocking ? "Fail" : "Pass"} | ${cells} |`;
  });

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
    "The report fails if any scan finds a critical or high issue, or does not complete. Each tool's full results are in this folder.",
    "",
  ].join("\n");

  return { failed, markdown };
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const reportDir = process.argv[2];
  if (!reportDir) {
    console.error("Usage: node scripts/security-summary.mjs <report folder>");
    process.exit(2);
  }
  const { failed, markdown } = summarize(reportDir);
  writeFileSync(join(reportDir, "summary.md"), markdown);
  console.log(markdown);
  process.exit(failed ? 1 : 0);
}
