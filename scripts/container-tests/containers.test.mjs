// SPDX-License-Identifier: Apache-2.0

// Tests of Fathom's running containers, as deploy/compose.yaml runs them with throwaway secrets and a
// throwaway certificate. Run with 'pnpm test:containers', which builds the images first.

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { request } from "node:https";
import { createServer } from "node:net";
import { join } from "node:path";
import { after, before, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { proxyProtocolHeader } from "../../packages/test-utils/src/https.ts";
import { cloneName } from "../../packages/test-utils/src/clone.ts";

const repositoryRoot = fileURLToPath(new URL("../..", import.meta.url));

// The release, commit and commit date, read through scripts/lib.sh as the scripts read them, so these
// images are the same as those 'pnpm stack:up' builds and share their tag.
const [version, commit, commitDate] = execFileSync(
  "bash",
  [
    "-c",
    'source scripts/lib.sh && printf "%s\\n" "$FATHOM_VERSION" "$FATHOM_COMMIT" "$FATHOM_COMMIT_DATE"',
  ],
  { cwd: repositoryRoot, encoding: "utf8" },
).split("\n");
// An address on the internet, which no isolated container may reach.
const internetAddress = "1.1.1.1";
const internetName = "example.com";

// Copies of the repository running these tests at once never replace each other's containers.
const project = cloneName("fathom-container-test", repositoryRoot);

let folder;
let certificate;
let port;

function compose(...args) {
  return execFileSync(
    "docker",
    [
      "compose",
      "--project-name",
      project,
      "--file",
      join(repositoryRoot, "deploy/compose.yaml"),
      ...args,
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        FATHOM_SECRETS_DIR: join(folder, "secrets"),
        FATHOM_TLS_CERT: join(folder, "cert.pem"),
        FATHOM_TLS_KEY: join(folder, "key.pem"),
        FATHOM_HTTPS_PORT: String(port),
        FATHOM_PUBLIC_URL: `https://localhost:${String(port)}`,
        FATHOM_IMAGE_TAG:
          process.env.FATHOM_IMAGE_TAG ?? cloneName("latest", repositoryRoot),
        FATHOM_SECURITY_FIXES_DATE:
          process.env.FATHOM_SECURITY_FIXES_DATE ??
          new Date().toISOString().slice(0, 10),
        FATHOM_VERSION: version,
        FATHOM_COMMIT: commit,
        FATHOM_COMMIT_DATE: commitDate,
      },
    },
  );
}

// Runs a shell command in a container, returning whether it succeeded and what it printed.
function run(service, command) {
  try {
    return { ok: true, output: compose("exec", "-T", service, ...command) };
  } catch (error) {
    return { ok: false, output: `${error.stdout ?? ""}${error.stderr ?? ""}` };
  }
}

// Probes a TCP address from a container: "connected", or why it could not connect.
function tcpProbe(service, host, targetPort) {
  if (service === "app") {
    const script = `require("node:net").connect({ host: "${host}", port: ${targetPort}, timeout: 3000 })
      .on("connect", () => { console.log("connected"); process.exit(0); })
      .on("timeout", () => { console.log("timeout"); process.exit(1); })
      .on("error", (error) => { console.log(error.code); process.exit(1); });`;
    return run(service, ["/nodejs/bin/node", "-e", script]).output.trim();
  }
  const result = run(service, [
    "nc",
    "-z",
    "-w",
    "3",
    host,
    String(targetPort),
  ]);
  return result.ok ? "connected" : result.output.trim() || "failed";
}

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.on("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const { port: found } = probe.address();
      probe.close(() => resolve(found));
    });
  });
}

function httpsGet(path) {
  return new Promise((resolve, reject) => {
    request({ host: "localhost", port, path, ca: certificate }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () =>
        resolve({ statusCode: response.statusCode, body }),
      );
    })
      .on("error", reject)
      .end();
  });
}

before(
  async () => {
    // Inside the repository's git-ignored .tmp/ folder, which every container runtime can share.
    mkdirSync(join(repositoryRoot, ".tmp"), { recursive: true });
    folder = mkdtempSync(join(repositoryRoot, ".tmp", "container-test-"));
    mkdirSync(join(folder, "secrets"));
    for (const name of [
      "postgres_superuser_password",
      "fathom_migrator_password",
      "fathom_app_password",
      "fathom_auth_secret",
    ]) {
      writeFileSync(
        join(folder, "secrets", name),
        randomBytes(24).toString("base64url"),
      );
    }
    execFileSync(
      "openssl",
      [
        "req",
        "-x509",
        "-newkey",
        "rsa:2048",
        "-nodes",
        "-days",
        "1",
        "-subj",
        "/CN=localhost",
        "-addext",
        "subjectAltName=DNS:localhost,IP:127.0.0.1",
        "-keyout",
        join(folder, "key.pem"),
        "-out",
        join(folder, "cert.pem"),
      ],
      { stdio: "ignore" },
    );
    // The containers' users must be able to read the secrets, which never leave this folder.
    chmodSync(folder, 0o755);
    for (const file of ["key.pem", "cert.pem"])
      chmodSync(join(folder, file), 0o644);
    certificate = readFileSync(join(folder, "cert.pem"), "utf8");
    port = await freePort();
    compose("up", "--build", "--detach", "--wait");
  },
  { timeout: 1_800_000 },
);

after(() => {
  try {
    if (port !== undefined) compose("down", "--volumes");
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
});

describe("reaching Fathom", () => {
  it("serves the page and the API through the proxy over HTTPS", async () => {
    const page = await httpsGet("/");
    assert.equal(page.statusCode, 200);
    assert.match(page.body, /<title>Fathom<\/title>/);
    // The API answers through the proxy; it needs a signed-in user for anything more.
    const greeting = await httpsGet("/api/greeting");
    assert.equal(greeting.statusCode, 401);
    assert.deepEqual(JSON.parse(greeting.body), { error: "Unauthorized" });
  });

  it("shows the release, commit and commit date the image was built from", async () => {
    const page = await httpsGet("/");
    const script = page.body.match(/src="(\/assets\/[^"]+\.js)"/)?.[1];
    assert.ok(script !== undefined);
    const { body } = await httpsGet(script);
    assert.ok(commit !== "");
    // The minifier may quote them in any of JavaScript's ways.
    const has = (name, value) =>
      ['"', "'", "`"].some((quote) =>
        body.includes(`${name}:${quote}${value}${quote}`),
      );
    assert.ok(has("version", version), "The release is missing");
    assert.ok(has("commit", commit), "The commit is missing");
    assert.ok(has("date", commitDate), "The commit date is missing");
  });

  it("logs the user's address, not the proxy's", () => {
    const proxyAddress = execFileSync(
      "docker",
      [
        "inspect",
        "--format",
        `{{(index .NetworkSettings.Networks "${project}_proxy-app").IPAddress}}`,
        `${project}-proxy-1`,
      ],
      { encoding: "utf8" },
    ).trim();
    const addresses = [
      ...compose("logs", "app").matchAll(/"clientAddress":"([^"]+)"/g),
    ].map((match) => match[1]);
    assert.ok(addresses.length > 0, "the requests must be logged");
    assert.ok(proxyAddress.length > 0);
    assert.ok(
      !addresses.includes(proxyAddress),
      `the proxy's address ${proxyAddress} was logged`,
    );
  });
});

describe("the application's image", () => {
  it("holds the server's code but no file only the tests use", () => {
    // Every file under /app but node_modules, listed by Node, since the image has no shell.
    const walk = `const { readdirSync } = require("node:fs");
      const files = (folder) => readdirSync(folder, { withFileTypes: true }).flatMap((entry) =>
        entry.name === "node_modules" ? [] : entry.isDirectory()
          ? files(folder + "/" + entry.name) : [folder + "/" + entry.name]);
      console.log(files("/app").join("\\n"));`;
    const { ok, output } = run("app", ["/nodejs/bin/node", "-e", walk]);
    assert.ok(ok, output);
    const paths = output.trim().split("\n");
    assert.ok(paths.includes("/app/apps/server/src/main.ts"), output);
    const testOnly = paths.filter((path) =>
      /(?:\.test\.ts|\/test-[^/]*\.ts)$/.test(path),
    );
    assert.deepEqual(testOnly, []);
  });
});

// Each check that something is unreachable is paired with one that the same probe reaches something,
// so a broken probe can't pass.
describe("network isolation", () => {
  it("stops the application reaching the internet, but not the database", () => {
    assert.equal(tcpProbe("app", "postgres", 5432), "connected");
    assert.notEqual(tcpProbe("app", internetAddress, 443), "connected");
    assert.notEqual(tcpProbe("app", internetName, 443), "connected");
  });

  it("stops the application looking up names on the internet", () => {
    const lookup = (name) =>
      run("app", [
        "/nodejs/bin/node",
        "-e",
        `require("node:dns").lookup("${name}", (error) => process.exit(error ? 1 : 0))`,
      ]).ok;
    assert.equal(lookup("postgres"), true);
    assert.equal(lookup(internetName), false);
  });

  it("stops the database reaching the internet, but not the application", () => {
    assert.equal(tcpProbe("postgres", "app", 8443), "connected");
    assert.notEqual(tcpProbe("postgres", internetAddress, 443), "connected");
    assert.match(tcpProbe("postgres", internetName, 443), /bad address/);
  });

  it("stops the proxy reaching the database, but not the application", () => {
    assert.equal(tcpProbe("proxy", "app", 8443), "connected");
    assert.match(tcpProbe("proxy", "postgres", 5432), /bad address/);
  });

  it("ran the migrations, then stopped", () => {
    const [line] = compose("ps", "--all", "--format", "json", "migrate")
      .trim()
      .split("\n");
    assert.equal(JSON.parse(line).ExitCode, 0);
  });

  it("refuses connections to the application from anywhere but the proxy, even with a header", () => {
    // A one-off container on the database's network, which can reach the application but is not
    // the proxy, sends a header claiming a fictional client. Accepted, the connection would wait
    // for the encrypted connection to start; refused, it is closed at once.
    const header = proxyProtocolHeader("192.0.2.66").toString("hex");
    const script = `const connection = require("node:net").connect(8443, "app");
      connection.on("connect", () => connection.write(Buffer.from("${header}", "hex")));
      connection.on("error", () => undefined);
      connection.on("close", () => { console.log("closed"); process.exit(0); });
      setTimeout(() => { console.log("open"); process.exit(0); }, 3000);`;
    const output = compose(
      "run",
      "--rm",
      "--no-deps",
      "-T",
      "migrate",
      "-e",
      script,
    );
    assert.match(output, /^closed$/m);
  });
});
