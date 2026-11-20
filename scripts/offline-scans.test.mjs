// SPDX-License-Identifier: Apache-2.0

// Tests of the security report offline and of preparing for it, run from a copy of the scripts in
// a throwaway repository, with stand-ins for docker and the offline helpers.

import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const scripts = fileURLToPath(new URL(".", import.meta.url));

// Semgrep's image without its digest, read from scripts/lib.sh so the test follows the version
// Renovate updates there.
const semgrepRead = spawnSync(
  "bash",
  ["-c", 'source scripts/lib.sh && printf "%s" "${fathom_semgrep_image%%@*}"'],
  { cwd: join(scripts, ".."), encoding: "utf8" },
);
assert.equal(semgrepRead.status, 0, semgrepRead.stderr);
const semgrepImage = semgrepRead.stdout;
assert.match(semgrepImage, /^semgrep\/semgrep:\S+$/, semgrepRead.stderr);

// Logs each call; images named in STUB_MISSING aren't present, a step named in STUB_FAIL fails, and
// each scanner reports nothing found.
const stubDocker = `#!/usr/bin/env bash
printf '%s\\n' "$*" >>"$STUB_LOG"
fails() { [[ " \${STUB_FAIL:-} " == *" $1 "* ]]; }
case " $* " in
  " info " | *" ps "*) ;;
  *" image inspect "*) [[ " \${STUB_MISSING:-} " != *" \${3%%@*} "* ]] ;;
  *" pull "*) ! fails pull ;;
  *" compose "*)
    printf 'tag=%s platform=%s\\n' "$FATHOM_IMAGE_TAG" "\${DOCKER_DEFAULT_PLATFORM:-unset}" >>"$STUB_LOG"
    ! fails build ;;
  *" --download-db-only "*) ! fails database ;;
  *" version --format json "*)
    fails database || printf '{"VulnerabilityDB":{"UpdatedAt":"2026-11-07T18:32:58Z"}}\\n' ;;
  *gitleaks*) printf '[]\\n' ;;
  *" semgrep scan "*) printf '{"results":[],"errors":[],"paths":{"scanned":["a.ts"]}}\\n' ;;
  *" --scanners misconfig "*) printf '{"SchemaVersion":2}\\n' ;;
  *" --scanners vuln,license "*)
    printf '{"SchemaVersion":2,"Results":[{"Class":"lang-pkgs","Target":"pnpm-lock.yaml"}]}\\n' ;;
  *) exit 1 ;;
esac
`;

// Stands in for scripts/offline.mjs, whose own tests cover it: the internet answers unless OFFLINE
// is set, and keeping the rules fails when STUB_FAIL names rules.
const stubOffline = `import { writeFileSync } from "node:fs";
const [command, , file] = process.argv.slice(2);
const fails = (step) => (process.env.STUB_FAIL ?? "").split(" ").includes(step);
if (command === "online") process.exit(process.env.OFFLINE ? 1 : 0);
if (command === "ryuk-image") console.log("testcontainers/ryuk:0.0.1");
if (command === "rules") {
  if (fails("rules")) process.exit(1);
  writeFileSync(file, '{"rules":[{"id":"example"}]}');
}
`;

let root;
let log;

function git(...args) {
  spawnSync("git", args, { cwd: root, encoding: "utf8" });
}

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), "fathom-offline-scans-"));
  cpSync(scripts, join(root, "scripts"), {
    recursive: true,
    filter: (path) => !path.endsWith(".test.mjs"),
  });
  writeFileSync(join(root, "scripts", "offline.mjs"), stubOffline);
  const bin = join(root, "bin");
  mkdirSync(bin);
  writeFileSync(join(bin, "docker"), stubDocker, { mode: 0o755 });
  writeFileSync(join(bin, "pnpm"), "#!/usr/bin/env bash\nexit 1\n", {
    mode: 0o755,
  });
  writeFileSync(join(root, ".trivyignore.yaml"), "vulnerabilities: []\n");
  writeFileSync(join(root, ".gitignore"), "bin/\noutput/\n.tmp/\n.cache/\n");
  mkdirSync(join(root, "node_modules"));
  log = join(root, "docker.log");
  writeFileSync(log, "");
  git("init", "--quiet");
  git("add", ".");
  git(
    "-c",
    "user.name=Example",
    "-c",
    "user.email=example@example.test",
    "commit",
    "--quiet",
    "-m",
    "Example",
  );
});

afterEach(() => {
  rmSync(root, { recursive: true, force: true });
});

function prepared() {
  const folder = join(root, ".cache", "offline");
  mkdirSync(folder, { recursive: true });
  writeFileSync(join(folder, "semgrep-rules.yaml"), '{"rules":[{}]}');
  writeFileSync(join(folder, "security-fixes-date"), "2026-11-07\n");
}

function run(script, args, environment = {}) {
  const result = spawnSync("bash", [`scripts/${script}`, ...args], {
    cwd: root,
    encoding: "utf8",
    env: {
      PATH: `${join(root, "bin")}:${process.env.PATH ?? ""}`,
      HOME: process.env.HOME,
      STUB_LOG: log,
      ...environment,
    },
  });
  return { ...result, calls: readFileSync(log, "utf8").split("\n") };
}

function onlyReport() {
  const reports = join(root, "output", "security");
  const [name] = readdirSync(reports).filter(
    (entry) => entry !== "fix-dates.json",
  );
  return join(reports, name);
}

describe("the security report offline", () => {
  it("runs every scanner without network access, from what was prepared", () => {
    prepared();
    const result = run("security-report.sh", ["--offline"]);
    assert.equal(result.status, 0, result.stderr);
    const scans = result.calls.filter((call) => call.startsWith("run "));
    assert.ok(scans.length >= 6, result.calls.join("\n"));
    for (const scan of scans) assert.match(scan, /--network none/, scan);
    assert.ok(
      scans.some((scan) =>
        /semgrep-rules\.yaml:\/rules\/semgrep-rules\.yaml:ro .* --config \/rules\/semgrep-rules\.yaml /.test(
          scan,
        ),
      ),
      scans.join("\n"),
    );
    assert.ok(
      scans.some((scan) =>
        /--skip-check-update --scanners misconfig/.test(scan),
      ),
      scans.join("\n"),
    );
    assert.ok(
      !result.calls.some((call) =>
        /compose|--download-db-only|^pull /.test(call),
      ),
      result.calls.join("\n"),
    );
    assert.ok(
      result.stdout.includes(
        "Working offline, with Trivy's database and Semgrep's rules as fetched on 2026-11-07",
      ),
      result.stdout,
    );
  });

  it("records the dependency audit and the image scans as skipped offline", () => {
    prepared();
    const result = run("security-report.sh", ["--offline"]);
    assert.equal(result.status, 0, result.stderr);
    assert.deepEqual(
      JSON.parse(readFileSync(join(onlyReport(), "scans.json"), "utf8"))
        .filter((scan) => scan.skipped)
        .map((scan) => [scan.file, scan.skipped]),
      [
        ["dependencies.json", "offline"],
        ["container-images.json", "offline"],
      ],
    );
    assert.equal(existsSync(join(onlyReport(), "dependencies.json")), false);
  });

  it("names everything missing until prepared", () => {
    const result = run("security-report.sh", ["--offline"], {
      STUB_MISSING: semgrepImage,
      STUB_FAIL: "database",
    });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        `error: Not ready to scan offline: missing the image ${semgrepImage}, Semgrep's rules, Trivy's vulnerability database, a finished 'pnpm offline:prepare'. Run 'pnpm offline:prepare' while connected`,
      ),
      result.stderr,
    );
    assert.ok(
      !result.calls.some(
        (call) => call.startsWith("run ") && !call.includes(" version "),
      ),
      result.calls.join("\n"),
    );
  });

  it("refuses to work offline where CI is set", () => {
    prepared();
    const result = run("security-report.sh", ["--offline"], { CI: "true" });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes("can't be used where CI is set"),
      result.stderr,
    );
  });

  it("refuses anything but --offline", () => {
    for (const args of [["--offline", "extra"], ["--online"]]) {
      const result = run("security-report.sh", args);
      assert.equal(result.status, 1);
      assert.ok(
        result.stderr.includes("error: Usage: security-report.sh [--offline]"),
        result.stderr,
      );
    }
  });

  it("stops without a connection, naming --offline", () => {
    const result = run("security-report.sh", [], { OFFLINE: "1" });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "Run 'pnpm check --offline' or 'pnpm security --offline'",
      ),
      result.stderr,
    );
    assert.ok(
      !result.calls.some((call) => call.startsWith("run ")),
      result.calls.join("\n"),
    );
  });
});

describe("preparing to work offline", () => {
  const marker = () => join(root, ".cache", "offline", "security-fixes-date");

  it("fetches everything, then marks the copy ready with the day's fixes", () => {
    const result = run("offline-prepare.sh", [], {
      FATHOM_SECURITY_FIXES_DATE: "2026-11-07",
    });
    assert.equal(result.status, 0, result.stderr);
    for (const image of [
      "aquasec/trivy",
      "zricethezav/gitleaks",
      "semgrep/semgrep",
      "testcontainers/ryuk:0.0.1",
    ])
      assert.ok(
        result.calls.some(
          (call) => call.startsWith("pull ") && call.includes(image),
        ),
        result.calls.join("\n"),
      );
    assert.ok(
      result.calls.some((call) => call.includes("--download-db-only")),
      result.calls.join("\n"),
    );
    assert.ok(
      result.calls.some((call) =>
        /compose --file deploy\/compose\.dev\.yaml build/.test(call),
      ),
      result.calls.join("\n"),
    );
    assert.equal(readFileSync(marker(), "utf8"), "2026-11-07\n");
  });

  it("builds the database image for this machine, under this copy's tag", () => {
    for (const [clone, tag] of [
      [undefined, "dev"],
      ["2", "dev-2"],
    ]) {
      if (clone !== undefined) {
        mkdirSync(join(root, ".dev"), { recursive: true });
        writeFileSync(join(root, ".dev", "clone"), `${clone}\n`);
      }
      const result = run("offline-prepare.sh", [], {
        DOCKER_DEFAULT_PLATFORM: "linux/amd64",
      });
      assert.equal(result.status, 0, result.stderr);
      assert.ok(
        result.calls.includes(`tag=${tag} platform=unset`),
        result.calls.join("\n"),
      );
    }
  });

  it("says the build failed, not to prepare again, when the build fails", () => {
    const result = run("offline-prepare.sh", [], { STUB_FAIL: "build" });
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes(
        "error: Could not build the database image; see the build's output above",
      ),
      result.stderr,
    );
  });

  for (const step of ["pull", "rules", "database", "build"])
    it(`leaves the copy not ready when the ${step} step fails`, () => {
      prepared();
      const result = run("offline-prepare.sh", [], { STUB_FAIL: step });
      assert.equal(result.status, 1);
      assert.equal(existsSync(marker()), false);
    });

  it("refuses without a connection, and leaves an earlier preparation as it was", () => {
    prepared();
    const result = run("offline-prepare.sh", [], { OFFLINE: "1" });
    assert.equal(result.status, 1);
    assert.equal(readFileSync(marker(), "utf8"), "2026-11-07\n");
  });

  it("refuses arguments", () => {
    const result = run("offline-prepare.sh", ["now"]);
    assert.equal(result.status, 1);
    assert.ok(
      result.stderr.includes("error: Usage: offline-prepare.sh"),
      result.stderr,
    );
  });
});
