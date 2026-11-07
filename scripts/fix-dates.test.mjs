// SPDX-License-Identifier: Apache-2.0

// Tests for finding when each fix the security scans name was released: the npm registry and
// Debian snapshot lookups, falling back to first sighting, and the dates kept between reports.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { dateFixes, firstSeen, recordFixDates } from "./fix-dates.mjs";
import { fixKey } from "./vulnerabilities.mjs";

const fixDatesScript = fileURLToPath(
  new URL("./fix-dates.mjs", import.meta.url),
);

const now = new Date("2026-11-07T12:00:00Z");

const vulnerability = (fields) => ({
  VulnerabilityID: "CVE-2026-1",
  InstalledVersion: "1.0.0",
  Severity: "HIGH",
  Status: "fixed",
  ...fields,
});

const npmFix = (name, version = "2.0.0") =>
  vulnerability({
    PkgName: name,
    FixedVersion: version,
    PkgIdentifier: { PURL: `pkg:npm/${name}@1.0.0` },
  });

const debianFix = vulnerability({
  PkgName: "zlib1g",
  InstalledVersion: "1:1.3-3",
  FixedVersion: "1:1.3-4",
  PkgIdentifier: { PURL: "pkg:deb/debian/zlib1g@1:1.3-3" },
});

const registry = (name) =>
  `https://registry.npmjs.org/${encodeURIComponent(name)}`;
const snapshotBinary = "https://snapshot.debian.org/mr/binary/zlib1g/";
const snapshotFiles =
  "https://snapshot.debian.org/mr/package/zlib/1%3A1.3-4/srcfiles?fileinfo=1";

const dsc = (archive_name, first_seen, name = "zlib_1.3-4.dsc") => ({
  archive_name,
  first_seen,
  name,
});

const binaryVersions = {
  result: [
    { binary_version: "1:1.3-3", source: "zlib", version: "1:1.3-3" },
    { binary_version: "1:1.3-4", source: "zlib", version: "1:1.3-4" },
  ],
};

const responses = {
  [registry("@scope/example")]: {
    time: { "2.0.0": "2026-10-27T22:26:03.755Z", "3.0.0": "2026-11-01" },
  },
  [snapshotBinary]: binaryVersions,
  [snapshotFiles]: {
    fileinfo: {
      a: [
        dsc("debian", "20260101T000000Z", "zlib_1.3.orig.tar.gz"),
        dsc("debian", "20261026T022331Z"),
      ],
      b: [
        dsc("debian-security", "20261020T080000Z"),
        dsc("debian-ports", "20261001T000000Z"),
        dsc("debian", "not a time"),
      ],
    },
  },
};

// Answers from a fixed list, recording each address asked and how many were asked at once.
function fetchFrom(answers) {
  const known = new Map(Object.entries(answers));
  const asked = [];
  let open = 0;
  let mostOpen = 0;
  const fetchJson = async (url) => {
    asked.push(url);
    open += 1;
    mostOpen = Math.max(mostOpen, open);
    await new Promise((resolve) => setImmediate(resolve));
    open -= 1;
    if (!known.has(url)) throw new Error(`no answer for ${url}`);
    return known.get(url);
  };
  return { asked, fetchJson, mostOpen: () => mostOpen };
}

describe("dating fixes", () => {
  let reportDir;

  beforeEach(() => {
    reportDir = mkdtempSync(join(tmpdir(), "fix-dates-"));
  });

  afterEach(() => {
    rmSync(reportDir, { recursive: true, force: true });
  });

  const writeImages = (...vulnerabilities) =>
    writeFileSync(
      join(reportDir, "container-images.json"),
      JSON.stringify([
        {
          image: "example",
          report: {
            SchemaVersion: 2,
            Results: [{ Type: "debian", Vulnerabilities: vulnerabilities }],
          },
        },
      ]),
    );

  it("dates npm fixes from the registry and Debian fixes from the version's own files", async () => {
    writeImages(npmFix("@scope/example"), debianFix);
    const { fetchJson } = fetchFrom(responses);
    assert.deepEqual(await dateFixes(reportDir, {}, { now, fetchJson }), {
      [fixKey("npm", "@scope/example", "2.0.0")]: {
        released: "2026-10-27T22:26:03.755Z",
        source: "npm registry",
      },
      [fixKey("debian", "zlib1g", "1:1.3-4")]: {
        released: "2026-10-20T08:00:00.000Z",
        source: "Debian snapshot archive",
      },
    });
  });

  it("fetches each address once, and only a few at a time", async () => {
    const names = Array.from({ length: 10 }, (_, i) => `package-${i}`);
    writeImages(
      npmFix("@scope/example", "2.0.0"),
      npmFix("@scope/example", "3.0.0"),
      ...names.map((name) => npmFix(name)),
    );
    const { asked, fetchJson, mostOpen } = fetchFrom(responses);
    const dates = await dateFixes(reportDir, {}, { now, fetchJson });
    assert.equal(
      asked.filter((url) => url === registry("@scope/example")).length,
      1,
    );
    assert.ok(mostOpen() <= 4, `asked ${mostOpen()} at once`);
    assert.equal(
      dates[fixKey("npm", "@scope/example", "3.0.0")].released,
      "2026-11-01T00:00:00.000Z",
    );
  });

  it("encodes package names in the addresses it asks", async () => {
    writeImages(npmFix("odd/../name?x=1"));
    const { asked, fetchJson } = fetchFrom({});
    await dateFixes(reportDir, {}, { now, fetchJson });
    assert.deepEqual(asked, [
      "https://registry.npmjs.org/odd%2F..%2Fname%3Fx%3D1",
    ]);
  });

  it("takes a release date after now as now", async () => {
    writeImages(npmFix("future"));
    const { fetchJson } = fetchFrom({
      [registry("future")]: { time: { "2.0.0": "2027-01-01T00:00:00Z" } },
    });
    const dates = await dateFixes(reportDir, {}, { now, fetchJson });
    assert.deepEqual(dates[fixKey("npm", "future", "2.0.0")], {
      released: now.toISOString(),
      source: "npm registry",
    });
  });

  it("counts a fix it cannot look up from when it was first seen, and keeps that date", async () => {
    writeImages(
      npmFix("unanswered"),
      vulnerability({
        PkgName: "zlib",
        FixedVersion: "1.3-r1",
        PkgIdentifier: { PURL: "pkg:apk/alpine/zlib@1.3-r0" },
      }),
      vulnerability({
        PkgName: "unknown",
        FixedVersion: "9",
        PkgIdentifier: { PURL: "pkg:deb/debian/unknown@8" },
      }),
    );
    const earlier = {
      [fixKey("apk", "zlib", "1.3-r1")]: {
        released: "2026-11-01T00:00:00.000Z",
        source: firstSeen,
      },
    };
    const { fetchJson } = fetchFrom({
      "https://snapshot.debian.org/mr/binary/unknown/": { result: [] },
    });
    assert.deepEqual(await dateFixes(reportDir, earlier, { now, fetchJson }), {
      [fixKey("npm", "unanswered", "2.0.0")]: {
        released: now.toISOString(),
        source: firstSeen,
      },
      ...earlier,
      [fixKey("debian", "unknown", "9")]: {
        released: now.toISOString(),
        source: firstSeen,
      },
    });
  });

  it("counts a Debian fix from first sighting when the archive fails or has no .dsc for it", async () => {
    writeImages(debianFix);
    for (const answers of [
      { [snapshotBinary]: binaryVersions },
      {
        [snapshotBinary]: binaryVersions,
        [snapshotFiles]: {
          fileinfo: {
            a: [
              dsc("debian", "20260101T000000Z", "zlib_1.3.orig.tar.gz"),
              dsc("debian-ports", "20261001T000000Z"),
            ],
          },
        },
      },
      { [snapshotBinary]: binaryVersions, [snapshotFiles]: {} },
    ]) {
      const { fetchJson } = fetchFrom(answers);
      const dates = await dateFixes(reportDir, {}, { now, fetchJson });
      assert.deepEqual(Object.values(dates), [
        { released: now.toISOString(), source: firstSeen },
      ]);
    }
  });

  it("keeps dates already looked up, and looks up again those only first seen", async () => {
    writeImages(npmFix("@scope/example"), debianFix);
    const known = {
      [fixKey("debian", "zlib1g", "1:1.3-4")]: {
        released: "2026-10-20T08:00:00.000Z",
        source: "Debian snapshot archive",
      },
      [fixKey("npm", "@scope/example", "2.0.0")]: {
        released: "2026-11-05T00:00:00.000Z",
        source: firstSeen,
      },
    };
    const { asked, fetchJson } = fetchFrom(responses);
    const dates = await dateFixes(reportDir, known, { now, fetchJson });
    assert.deepEqual(asked, [registry("@scope/example")]);
    assert.equal(
      dates[fixKey("npm", "@scope/example", "2.0.0")].source,
      "npm registry",
    );
  });

  it("dates nothing when the report has no vulnerability with a fix", async () => {
    writeFileSync(join(reportDir, "files.json"), "not json");
    assert.deepEqual(await dateFixes(reportDir, undefined, { now }), {});
  });

  describe("recording the dates", () => {
    let knownPath;

    beforeEach(() => {
      knownPath = join(reportDir, "kept-fix-dates.json");
    });

    const read = (path) => JSON.parse(readFileSync(path, "utf8"));

    it("writes the report's dates and adds them to those kept between reports", async () => {
      writeImages(npmFix("@scope/example"));
      const other = { "npm:other@1.0.0": { released: "x", source: "y" } };
      writeFileSync(knownPath, JSON.stringify(other));
      const { fetchJson } = fetchFrom(responses);
      await recordFixDates(reportDir, knownPath, { now, fetchJson });
      const reportDates = read(join(reportDir, "fix-dates.json"));
      assert.deepEqual(Object.keys(reportDates), [
        fixKey("npm", "@scope/example", "2.0.0"),
      ]);
      assert.deepEqual(read(knownPath), { ...other, ...reportDates });
    });

    it("starts the kept dates when there are none yet", async () => {
      writeImages(npmFix("@scope/example"));
      const { fetchJson } = fetchFrom(responses);
      await recordFixDates(reportDir, knownPath, { now, fetchJson });
      assert.equal(existsSync(knownPath), true);
    });

    it("leaves kept dates it cannot read as they are, and says so", async () => {
      writeImages(npmFix("@scope/example"));
      for (const unreadable of ["not json", "[1, 2]", '"text"', "null"]) {
        writeFileSync(knownPath, unreadable);
        const warnings = [];
        const { fetchJson } = fetchFrom(responses);
        await recordFixDates(reportDir, knownPath, {
          now,
          fetchJson,
          warn: (message) => warnings.push(message),
        });
        assert.equal(readFileSync(knownPath, "utf8"), unreadable);
        assert.equal(existsSync(join(reportDir, "fix-dates.json")), true);
        assert.match(warnings.join(), /could not be read, so it was left/);
      }
    });
  });
});

describe("fix dates command", () => {
  it("exits with 2 when no report folder is given", () => {
    const result = spawnSync(process.execPath, [fixDatesScript], {
      encoding: "utf8",
    });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Usage/);
  });
});
