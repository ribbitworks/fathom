// SPDX-License-Identifier: Apache-2.0

// Finds when each fix the security scans name was released, since the Security Plan's fix times
// count from then. npm packages are dated from the npm registry and Debian packages from Debian's
// snapshot archive. A fix that cannot be looked up counts from the first report that saw it.
// Dates are kept in output/security/fix-dates.json between reports, and each report folder gets
// its own fix-dates.json, so the report records the dates it was judged by.

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  fixKey,
  vulnerabilitiesIn,
  vulnerabilityScanFiles,
} from "./vulnerabilities.mjs";

const lookupTimeout = 20_000;

// Lookups run a few at a time, so a report with many findings does not flood the archives and
// have its requests refused, which would leave fixes dated only by first sighting.
const lookupsAtOnce = 4;

export const firstSeen = "first seen";

function readJson(path) {
  if (!existsSync(path)) return undefined;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}

// Kept dates are an object of fixes; anything else, such as a list, cannot be read as dates.
function readDates(path) {
  const dates = readJson(path);
  return dates !== null && typeof dates === "object" && !Array.isArray(dates)
    ? dates
    : undefined;
}

async function defaultFetchJson(url, signal) {
  const response = await fetch(url, { signal });
  if (!response.ok) throw new Error(`${url} answered ${response.status}`);
  return response.json();
}

function isoDate(value) {
  const time = Date.parse(value);
  return Number.isNaN(time) ? undefined : new Date(time).toISOString();
}

// Snapshot writes times as 20261026T022331Z.
function snapshotTime(value) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(
    String(value),
  );
  if (!match) return undefined;
  const [, year, month, day, hour, minute, second] = match;
  return isoDate(`${year}-${month}-${day}T${hour}:${minute}:${second}Z`);
}

async function npmRelease(getJson, name, version) {
  const packument = await getJson(
    `https://registry.npmjs.org/${encodeURIComponent(name)}`,
  );
  return isoDate(new Map(Object.entries(packument?.time ?? {})).get(version));
}

// Debian publishes a fix in debian-security first and the main archive later; the earliest counts.
// Only the version's .dsc file is its own: the upstream tarball is shared with earlier revisions.
async function debianRelease(getJson, name, version) {
  const binary = await getJson(
    `https://snapshot.debian.org/mr/binary/${encodeURIComponent(name)}/`,
  );
  const match = (binary?.result ?? []).find(
    (entry) => entry.binary_version === version || entry.version === version,
  );
  if (!match) return undefined;
  const files = await getJson(
    `https://snapshot.debian.org/mr/package/${encodeURIComponent(match.source)}/${encodeURIComponent(match.version)}/srcfiles?fileinfo=1`,
  );
  const seen = Object.values(files?.fileinfo ?? {})
    .flat()
    .filter(
      (file) =>
        ["debian", "debian-security"].includes(file?.archive_name) &&
        String(file?.name).endsWith(".dsc"),
    )
    .map((file) => snapshotTime(file.first_seen))
    .filter(Boolean)
    .sort();
  return seen[0];
}

const lookups = new Map([
  ["npm", { source: "npm registry", release: npmRelease }],
  ["debian", { source: "Debian snapshot archive", release: debianRelease }],
]);

// Fetches each address once, however many fixes need it, such as one npm package's versions.
function onceEach(fetchJson) {
  const answers = new Map();
  return (url) => {
    if (!answers.has(url))
      answers.set(url, fetchJson(url, AbortSignal.timeout(lookupTimeout)));
    return answers.get(url);
  };
}

async function inTurn(tasks, atOnce) {
  const queue = [...tasks];
  const worker = async () => {
    for (let task = queue.shift(); task; task = queue.shift()) await task();
  };
  await Promise.all(Array.from({ length: atOnce }, worker));
}

// Dates every fix the report's scans name. Fixes already dated from a lookup are kept; those only
// dated by first sighting are looked up again, in case the lookup failed last time. A release date
// after now is taken as now, so a wrong clock or record cannot push a fix's due date out.
export async function dateFixes(
  reportDir,
  knownDates = {},
  { now = new Date(), fetchJson = defaultFetchJson } = {},
) {
  const wanted = new Map();
  for (const file of vulnerabilityScanFiles) {
    const results = readJson(join(reportDir, file));
    for (const finding of vulnerabilitiesIn(file, results))
      for (const version of finding.fixedVersions)
        wanted.set(fixKey(finding.ecosystem, finding.name, version), {
          ecosystem: finding.ecosystem,
          name: finding.name,
          version,
        });
  }
  const known = new Map(Object.entries(knownDates ?? {}));
  const getJson = onceEach(fetchJson);
  const dates = new Map();
  await inTurn(
    [...wanted].map(([key, fix]) => async () => {
      const earlier = known.get(key);
      if (earlier?.released && earlier.source !== firstSeen) {
        dates.set(key, earlier);
        return;
      }
      const lookup = lookups.get(fix.ecosystem);
      let released;
      try {
        released = await lookup?.release(getJson, fix.name, fix.version);
      } catch {
        released = undefined;
      }
      if (released && released > now.toISOString())
        released = now.toISOString();
      dates.set(
        key,
        released
          ? { released, source: lookup.source }
          : (earlier ?? { released: now.toISOString(), source: firstSeen }),
      );
    }),
    lookupsAtOnce,
  );
  return Object.fromEntries(dates);
}

// Writes the report's dates, and adds them to the dates kept between reports. A kept file that
// cannot be read is left as it is, rather than replaced and its first sightings lost.
export async function recordFixDates(
  reportDir,
  knownPath,
  { warn = console.error, ...options } = {},
) {
  const known = readDates(knownPath);
  const unreadable = existsSync(knownPath) && known === undefined;
  const dates = await dateFixes(reportDir, known ?? {}, options);
  const text = (value) => `${JSON.stringify(value, null, 2)}\n`;
  writeFileSync(join(reportDir, "fix-dates.json"), text(dates));
  if (unreadable)
    warn(`warning: ${knownPath} could not be read, so it was left as it is`);
  else writeFileSync(knownPath, text({ ...known, ...dates }));
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  const reportDir = process.argv[2];
  if (!reportDir) {
    console.error("Usage: node scripts/fix-dates.mjs <report folder>");
    process.exit(2);
  }
  await recordFixDates(
    reportDir,
    fileURLToPath(
      new URL("../output/security/fix-dates.json", import.meta.url),
    ),
  );
}
