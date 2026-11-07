// SPDX-License-Identifier: Apache-2.0

// Reads the vulnerabilities pnpm audit and Trivy found in a security report, each with the fixed
// version that would replace what is installed, for dating fixes and judging them against the
// Security Plan's fix times.

export const vulnerabilityScanFiles = [
  "dependencies.json",
  "files.json",
  "container-images.json",
];

export function fixKey(ecosystem, name, version) {
  return `${ecosystem}:${name}@${version}`;
}

// A purl names its ecosystem, such as pkg:npm/glob@10.5.0 or pkg:deb/debian/zlib1g@1.3.
function ecosystemOf(purl, targetType) {
  if (typeof purl === "string") {
    if (purl.startsWith("pkg:npm/")) return "npm";
    if (purl.startsWith("pkg:deb/debian/")) return "debian";
    const type = /^pkg:([^/]+)\//.exec(purl)?.[1];
    if (type) return type;
  }
  if (["npm", "pnpm", "yarn", "node-pkg"].includes(targetType)) return "npm";
  return typeof targetType === "string" && targetType ? targetType : "unknown";
}

function versionParts(version) {
  const match = /^v?(\d+)\.(\d+)\.(\d+)/.exec(String(version));
  return match ? match.slice(1).map(Number) : undefined;
}

// Orders npm versions by major, minor and patch; versions that cannot be read sort last.
function compareVersions(a, b) {
  const x = versionParts(a);
  const y = versionParts(b);
  if (!x || !y) return Number(!x) - Number(!y);
  const differ = x.findIndex((part, index) => part !== y.at(index));
  return differ === -1 ? 0 : x.at(differ) - y.at(differ);
}

// The fixed version that would replace what is installed. Trivy and pnpm audit list a fix for each
// release line, such as 11.0.1 and 10.2.3; the clock starts with the fix on the installed major
// line, or failing that the lowest later one, so a fix on another line cannot start it early.
// Versions that cannot be compared are kept, so a fix is never dropped for an unusual version.
function fixesFor(ecosystem, installed, fixedVersions) {
  const unique = [...new Set(fixedVersions.filter(Boolean))];
  if (ecosystem !== "npm" || unique.length < 2) return unique;
  const installedParts = versionParts(installed);
  if (!installedParts) return unique;
  const later = unique
    .filter((version) => {
      const parts = versionParts(version);
      return !parts || compareVersions(version, installed) > 0;
    })
    .sort(compareVersions);
  if (later.length === 0) return unique;
  const sameLine = later.find(
    (version) => versionParts(version)?.[0] === installedParts[0],
  );
  return [sameLine ?? later[0]];
}

// pnpm audit gives the fixed versions as a range, such as ">=9.0.6 <10.0.0 || >=10.2.3". A range
// it marks as having no fix is "<0.0.0" or empty. Any other range without a lower bound still
// means a fix exists, so it is kept whole, to be dated from when it was first seen.
function patchedVersions(range) {
  const patched = String(range ?? "").trim();
  if (patched === "" || patched === "<0.0.0") return [];
  const lowerBounds = [...patched.matchAll(/>=\s*([^\s|<>=]+)/g)].map(
    (match) => match[1],
  );
  return lowerBounds.length ? lowerBounds : [patched];
}

function auditVulnerabilities(results) {
  const found = [];
  for (const advisory of Object.values(results?.advisories ?? {})) {
    const fixed = patchedVersions(advisory?.patched_versions);
    for (const finding of advisory?.findings ?? [{}]) {
      found.push({
        id: String(
          advisory.github_advisory_id ??
            advisory.cves?.[0] ??
            advisory.id ??
            "an advisory",
        ),
        ecosystem: "npm",
        name: String(advisory.module_name),
        installed: finding?.version,
        severity: advisory.severity,
        fixedVersions: fixesFor("npm", finding?.version, fixed),
      });
    }
  }
  return found;
}

function trivyVulnerabilities(reports) {
  const found = [];
  for (const report of reports) {
    for (const target of report?.Results ?? []) {
      for (const vulnerability of target.Vulnerabilities ?? []) {
        const ecosystem = ecosystemOf(
          vulnerability.PkgIdentifier?.PURL,
          target.Type,
        );
        const fixed =
          vulnerability.Status === "fixed" ||
          (vulnerability.Status === undefined && vulnerability.FixedVersion)
            ? String(vulnerability.FixedVersion ?? "")
                .split(",")
                .map((version) => version.trim())
            : [];
        found.push({
          id: String(vulnerability.VulnerabilityID ?? "a vulnerability"),
          ecosystem,
          name: String(vulnerability.PkgName),
          installed: vulnerability.InstalledVersion,
          severity: vulnerability.Severity,
          fixedVersions: fixesFor(
            ecosystem,
            vulnerability.InstalledVersion,
            fixed,
          ),
        });
      }
    }
  }
  return found;
}

// Every vulnerability in one scan's results. A finding with no fix released has no fixed versions.
export function vulnerabilitiesIn(scanFile, results) {
  if (scanFile === "dependencies.json") return auditVulnerabilities(results);
  if (scanFile === "container-images.json")
    return trivyVulnerabilities(
      (Array.isArray(results) ? results : []).map((scan) => scan?.report),
    );
  return trivyVulnerabilities([results]);
}
