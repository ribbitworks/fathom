// Summarizes a security report folder into summary.md, and fails on critical or high findings
// or on any scan that did not complete.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

export const severities = ["critical", "high", "medium", "low"];

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
    completed: (results) =>
      Array.isArray(results.results) &&
      (results.paths?.scanned?.length ?? 0) > 0 &&
      !(results.errors ?? []).some((error) => error.level === "error"),
    count(results) {
      const counts = emptyCounts();
      for (const finding of results.results)
        addSeverity(counts, finding.extra?.severity);
      return counts;
    },
    notes: (results) =>
      results.errors?.length
        ? [
            `Semgrep reported ${String(results.errors.length)} errors; see code.json.`,
          ]
        : [],
  },
  {
    name: "Vulnerabilities, misconfiguration, and licences",
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
        for (const item of [
          ...(target.Vulnerabilities ?? []),
          ...(target.Misconfigurations ?? []),
        ]) {
          addSeverity(counts, item.Severity);
        }
        // Trivy lists every package's licence; permissive licences are not findings.
        for (const licence of target.Licenses ?? []) {
          if (licence.Severity !== "LOW") addSeverity(counts, licence.Severity);
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
