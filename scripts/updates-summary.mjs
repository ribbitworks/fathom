// Summarizes a Renovate dry run into updates.md. Available updates are listed, not treated as
// failures. The command fails when Renovate did not report its results, or reported problems such
// as dependencies it could not look up.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const warningLevel = 40;

// Reasons Renovate gives for skipping a dependency on purpose, such as the project's own workspace
// packages. Any other reason means a lookup went wrong, and is a problem.
export const intentionalSkipReasons = new Set([
  "internal-package",
  "unspecified-version",
  "disabled",
  "ignored",
  "package-rules",
]);

// Reads Renovate's JSON log: the dependency list it reports at the end of a dry run, and any
// warnings or errors it logged along the way.
export function parseRenovateLog(logText) {
  let packageFiles;
  const problems = [];
  for (const line of logText.split("\n")) {
    if (!line.trim()) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.msg === "packageFiles with updates")
      packageFiles = entry.config ?? {};
    if (typeof entry.level === "number" && entry.level >= warningLevel) {
      problems.push(`Renovate logged: ${String(entry.msg)}`);
    }
  }
  return { packageFiles, problems };
}

export function summarizeUpdates(packageFiles) {
  const updates = [];
  const problems = [];
  const notChecked = [];
  const dependencyCounts = new Map();
  for (const [manager, files] of Object.entries(packageFiles)) {
    for (const file of files) {
      for (const dependency of file.deps ?? []) {
        const name = dependency.depName ?? "unknown";
        dependencyCounts.set(manager, (dependencyCounts.get(manager) ?? 0) + 1);
        if (dependency.skipReason) {
          const description = `${name} in ${String(file.packageFile)}: ${String(dependency.skipReason)}`;
          if (intentionalSkipReasons.has(dependency.skipReason))
            notChecked.push(description);
          else problems.push(`${description} (skipped)`);
        }
        for (const warning of dependency.warnings ?? []) {
          problems.push(
            `${name} in ${String(file.packageFile)}: ${String(warning.message ?? warning.topic ?? "lookup warning")}`,
          );
        }
        for (const update of dependency.updates ?? []) {
          updates.push({
            dependency: name,
            file: file.packageFile ?? "unknown",
            current: dependency.currentValue ?? dependency.currentDigest ?? "",
            available: update.newVersion ?? update.newDigest ?? "",
            type: update.updateType ?? "",
            breaking: update.isBreaking === true,
            waiting: update.pendingChecks === true,
          });
        }
      }
    }
  }
  return { updates, problems, notChecked, dependencyCounts };
}

function updateTable(updates) {
  return [
    "| Dependency | File | Current | Available | Type | Breaking |",
    "| --- | --- | --- | --- | --- | --- |",
    ...updates.map(
      (u) =>
        `| ${u.dependency} | ${u.file} | ${u.current} | ${u.available} | ${u.type} | ${u.breaking ? "Yes" : "No"} |`,
    ),
    "",
  ];
}

export function renderUpdates(
  reportName,
  { updates, problems, notChecked = [], dependencyCounts },
) {
  const managers = [...dependencyCounts.entries()].map(
    ([manager, total]) => `${manager} (${String(total)})`,
  );
  const ready = updates.filter((u) => !u.waiting);
  const waiting = updates.filter((u) => u.waiting);
  return [
    "# Dependency Updates",
    "",
    `- **Run:** ${reportName}`,
    `- **Dependencies found:** ${managers.length ? managers.join(", ") : "none"}`,
    `- **Updates available now:** ${String(ready.length)}`,
    `- **Updates waiting for the seven-day minimum release age:** ${String(waiting.length)}`,
    `- **Problems:** ${String(problems.length)}`,
    "",
    ...(ready.length ? ["## Available Now", "", ...updateTable(ready)] : []),
    ...(waiting.length ? ["## Waiting", "", ...updateTable(waiting)] : []),
    ...(problems.length
      ? ["## Problems", "", ...problems.map((problem) => `- ${problem}`), ""]
      : []),
    ...(notChecked.length
      ? [
          "## Not Checked",
          "",
          "Skipped on purpose, for example the project's own packages.",
          "",
          ...notChecked.map((item) => `- ${item}`),
          "",
        ]
      : []),
    "Updates are applied as separate, reviewed changes.",
    "",
  ].join("\n");
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const reportDir = process.argv[2];
  if (!reportDir) {
    console.error("Usage: node scripts/updates-summary.mjs <report folder>");
    process.exit(2);
  }
  const logPath = join(reportDir, "renovate.jsonl");
  const { packageFiles, problems: logProblems } = parseRenovateLog(
    existsSync(logPath) ? readFileSync(logPath, "utf8") : "",
  );
  if (packageFiles === undefined) {
    console.error(
      `Renovate did not report its results; see ${logPath} and renovate-errors.log`,
    );
    process.exit(1);
  }
  const summary = summarizeUpdates(packageFiles);
  summary.problems.unshift(...logProblems);
  const markdown = renderUpdates(basename(reportDir), summary);
  writeFileSync(join(reportDir, "updates.md"), markdown);
  console.log(markdown);
  process.exit(summary.problems.length ? 1 : 0);
}
