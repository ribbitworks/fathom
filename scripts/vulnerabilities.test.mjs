// SPDX-License-Identifier: Apache-2.0

// Tests for reading the vulnerabilities in a security report: pnpm audit's advisories and ranges,
// Trivy's fixed versions and ecosystems, and choosing the fix that would replace what is installed.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fixKey, vulnerabilitiesIn } from "./vulnerabilities.mjs";

const trivyReport = (Type, ...Vulnerabilities) => ({
  SchemaVersion: 2,
  Results: [{ Type, Vulnerabilities }],
});

const vulnerability = (fields) => ({
  VulnerabilityID: "CVE-2026-1",
  PkgName: "example",
  InstalledVersion: "1.0.0",
  Severity: "HIGH",
  ...fields,
});

const auditOf = (...advisories) => ({
  advisories: Object.fromEntries(advisories.map((a, i) => [i, a])),
});

const fixesFrom = (found) =>
  found.map((finding) => [finding.installed, finding.fixedVersions]);

describe("vulnerabilities in pnpm audit's results", () => {
  it("reads one finding for each installed version, naming the advisory", () => {
    const found = vulnerabilitiesIn(
      "dependencies.json",
      auditOf(
        {
          github_advisory_id: "GHSA-1",
          module_name: "glob",
          severity: "moderate",
          patched_versions: ">=9.0.6 <10.0.0 || >=10.2.3",
          findings: [{ version: "9.0.1" }, { version: "10.1.0" }],
        },
        {
          cves: ["CVE-2026-2"],
          module_name: "cve",
          severity: "high",
          patched_versions: "<0.0.0",
          findings: [{ version: "1.0.0" }],
        },
        { id: 3, module_name: "numbered", severity: "low" },
        { module_name: "unnamed", severity: "low" },
        { module_name: "none found", severity: "low", findings: [] },
      ),
    );
    assert.deepEqual(
      found.map((f) => [f.id, f.name, f.installed, f.fixedVersions]),
      [
        ["GHSA-1", "glob", "9.0.1", ["9.0.6"]],
        ["GHSA-1", "glob", "10.1.0", ["10.2.3"]],
        ["CVE-2026-2", "cve", "1.0.0", []],
        ["3", "numbered", undefined, []],
        ["an advisory", "unnamed", undefined, []],
      ],
    );
    assert.deepEqual(vulnerabilitiesIn("dependencies.json", undefined), []);
  });

  it("treats only an empty range or <0.0.0 as no fix, keeping any other range whole", () => {
    const fixed = (patched_versions) =>
      vulnerabilitiesIn(
        "dependencies.json",
        auditOf({
          module_name: "example",
          severity: "high",
          patched_versions,
          findings: [{ version: "1.0.0" }],
        }),
      )[0].fixedVersions;
    assert.deepEqual(fixed(""), []);
    assert.deepEqual(fixed(" <0.0.0 "), []);
    assert.deepEqual(fixed(undefined), []);
    assert.deepEqual(fixed(">1.2.3"), [">1.2.3"]);
    assert.deepEqual(fixed("^1.2.3"), ["^1.2.3"]);
  });
});

describe("vulnerabilities in Trivy's results", () => {
  it("reads fixed versions only for findings with a fix released", () => {
    const found = vulnerabilitiesIn(
      "files.json",
      trivyReport(
        "pnpm",
        vulnerability({ FixedVersion: "2.0.0", Status: "fixed" }),
        vulnerability({ FixedVersion: "2.0.0" }),
        vulnerability({ Status: "affected", FixedVersion: "" }),
        vulnerability({ Status: "will_not_fix", FixedVersion: "2.0.0" }),
      ),
    );
    assert.deepEqual(
      found.map((f) => [f.ecosystem, f.fixedVersions]),
      [
        ["npm", ["2.0.0"]],
        ["npm", ["2.0.0"]],
        ["npm", []],
        ["npm", []],
      ],
    );
  });

  it("starts the clock with the fix on the installed major line, or else the lowest later one", () => {
    const found = vulnerabilitiesIn(
      "files.json",
      trivyReport(
        "pnpm",
        vulnerability({
          InstalledVersion: "10.1.0",
          FixedVersion: "11.0.1, 10.2.3, 9.0.6",
          Status: "fixed",
        }),
        vulnerability({
          InstalledVersion: "8.0.0",
          FixedVersion: "11.0.1, 10.2.3, 9.0.6",
          Status: "fixed",
        }),
        vulnerability({
          InstalledVersion: "12.0.0",
          FixedVersion: "11.0.1, 10.2.3",
          Status: "fixed",
        }),
        vulnerability({
          InstalledVersion: "1.0.0",
          FixedVersion: "next, 1.0.0, 0.9.0",
          Status: "fixed",
        }),
        vulnerability({
          InstalledVersion: "unusual",
          FixedVersion: "2.0.0, 3.0.0",
          Status: "fixed",
        }),
      ),
    );
    assert.deepEqual(fixesFrom(found), [
      ["10.1.0", ["10.2.3"]],
      ["8.0.0", ["9.0.6"]],
      ["12.0.0", ["11.0.1", "10.2.3"]],
      ["1.0.0", ["next"]],
      ["unusual", ["2.0.0", "3.0.0"]],
    ]);
  });

  it("keeps every fixed version outside npm, where versions are not compared", () => {
    const found = vulnerabilitiesIn("container-images.json", [
      {
        report: trivyReport(
          "debian",
          vulnerability({
            InstalledVersion: "1:1.3-3",
            FixedVersion: "1:1.3-4, 1:1.3-3+deb13u1",
            Status: "fixed",
          }),
        ),
      },
    ]);
    assert.deepEqual(fixesFrom(found), [
      ["1:1.3-3", ["1:1.3-4", "1:1.3-3+deb13u1"]],
    ]);
  });

  it("names the ecosystem from the package URL before the target type", () => {
    const ecosystems = vulnerabilitiesIn("container-images.json", [
      {
        report: trivyReport(
          "debian",
          vulnerability({ PkgIdentifier: { PURL: "pkg:npm/glob@1.0.0" } }),
          vulnerability({
            PkgIdentifier: { PURL: "pkg:deb/debian/zlib1g@1.3" },
          }),
          vulnerability({ PkgIdentifier: { PURL: "pkg:apk/alpine/zlib@1" } }),
          vulnerability({ PkgIdentifier: { PURL: "not a purl" } }),
        ),
      },
      { report: trivyReport(undefined, vulnerability({})) },
      { report: null },
    ]).map((f) => f.ecosystem);
    assert.deepEqual(ecosystems, ["npm", "debian", "apk", "debian", "unknown"]);
    assert.deepEqual(vulnerabilitiesIn("container-images.json", {}), []);
  });

  it("names a vulnerability that has no ID", () => {
    const [found] = vulnerabilitiesIn(
      "files.json",
      trivyReport("pnpm", { PkgName: "example", Severity: "LOW" }),
    );
    assert.equal(found.id, "a vulnerability");
  });
});

describe("fix keys", () => {
  it("names a fix by ecosystem, package and version", () => {
    assert.equal(fixKey("npm", "@scope/a", "1.0.0"), "npm:@scope/a@1.0.0");
  });
});
