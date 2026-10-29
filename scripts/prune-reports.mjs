// SPDX-License-Identifier: Apache-2.0

// Deletes dated report folders in output/ that are past their retention period.
// Security reports are always kept for at least one calendar year, as the security plan requires.
// The optional number of days sets how long other reports are kept, and can only lengthen how long
// security reports are kept.
// Usage: node scripts/prune-reports.mjs [days]

import { existsSync, lstatSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const defaultRetentionDays = 365;
export const maxRetentionDays = 36500;
const millisecondsPerDay = 86_400_000;
const reportNamePattern = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})-(\d{2})Z$/;

// Report folders are named by their UTC start time, such as 2026-10-27T13-28-14Z.
export function parseReportTime(name) {
  const match = reportNamePattern.exec(name);
  if (!match) return undefined;
  const [year, month, day, hour, minute, second] = match
    .slice(1)
    .map((part) => Number.parseInt(part, 10));
  const time = new Date(Date.UTC(year, month - 1, day, hour, minute, second));
  const isRealDate =
    time.getUTCMonth() === month - 1 && time.getUTCDate() === day;
  return isRealDate ? time : undefined;
}

export function parseRetentionDays(value) {
  if (value === undefined) return defaultRetentionDays;
  if (!/^\d+$/.test(value))
    throw new Error("The retention period must be a whole number of days");
  const days = Number.parseInt(value, 10);
  if (days < 1 || days > maxRetentionDays) {
    throw new Error(
      `The retention period must be between 1 and ${String(maxRetentionDays)} days`,
    );
  }
  return days;
}

// Reports from before the cutoff are deleted. An earlier cutoff keeps reports longer.
export function cutoffFor(reportType, now, days) {
  const byDays = new Date(now.getTime() - days * millisecondsPerDay);
  if (reportType !== "security") return byDays;
  const oneCalendarYear = new Date(now.getTime());
  oneCalendarYear.setUTCFullYear(oneCalendarYear.getUTCFullYear() - 1);
  return byDays < oneCalendarYear ? byDays : oneCalendarYear;
}

function isRealFolder(path) {
  const stats = lstatSync(path);
  return stats.isDirectory() && !stats.isSymbolicLink();
}

// Lists the report folders to delete. Symbolic links and folders without a dated name are never included.
export function findExpiredReports(outputDir, now, days) {
  if (!existsSync(outputDir)) return [];
  const expired = [];
  for (const reportType of readdirSync(outputDir)) {
    const typeDir = join(outputDir, reportType);
    if (!isRealFolder(typeDir)) continue;
    const cutoff = cutoffFor(reportType, now, days);
    for (const name of readdirSync(typeDir)) {
      const reportDir = join(typeDir, name);
      const time = parseReportTime(name);
      if (time && time < cutoff && isRealFolder(reportDir))
        expired.push(reportDir);
    }
  }
  return expired;
}

// pnpm may pass a leading "--" through to the script; it is dropped, and anything extra is refused.
export function parseArguments(args) {
  const values = args[0] === "--" ? args.slice(1) : args;
  if (values.length > 1)
    throw new Error("Usage: node scripts/prune-reports.mjs [days]");
  return parseRetentionDays(values[0]);
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  let days;
  try {
    days = parseArguments(process.argv.slice(2));
  } catch (error) {
    console.error(
      `error: ${error instanceof Error ? error.message : String(error)}`,
    );
    process.exit(2);
  }
  const outputDir = fileURLToPath(new URL("../output", import.meta.url));
  const expired = findExpiredReports(outputDir, new Date(), days);
  for (const reportDir of expired) rmSync(reportDir, { recursive: true });
  console.log(`==> Removed ${String(expired.length)} expired reports`);
  console.log(
    "==> Security reports must also be kept for at least one year in the location agreed with IT; copy them there before they expire here.",
  );
}
