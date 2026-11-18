// SPDX-License-Identifier: Apache-2.0

// Tests of the helpers for working offline: whether the internet answers, keeping rules, and
// finding the Ryuk image Testcontainers starts.

import assert from "node:assert/strict";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, it } from "node:test";
import { keepRules, reachable, reaperSource, ryukImage } from "./offline.mjs";

const folders = [];

function folder() {
  const made = mkdtempSync(join(tmpdir(), "fathom-offline-"));
  folders.push(made);
  return made;
}

afterEach(() => {
  for (const made of folders.splice(0))
    rmSync(made, { recursive: true, force: true });
});

const answering =
  (status, body = "") =>
  async () =>
    new Response(body, { status });
const failing = async () => {
  throw new TypeError("fetch failed");
};

describe("telling whether the internet answers", () => {
  it("counts any answer, a refusal included", async () => {
    assert.equal(
      await reachable("https://example.test/", { fetch: answering(200) }),
      true,
    );
    assert.equal(
      await reachable("https://example.test/", { fetch: answering(403) }),
      true,
    );
  });

  it("counts no answer as no connection", async () => {
    assert.equal(
      await reachable("https://example.test/", { fetch: failing }),
      false,
    );
  });

  it("gives up once the time allowed has passed", async () => {
    const waitForAbort = (_address, { signal }) =>
      new Promise((_resolve, reject) =>
        signal.addEventListener("abort", () => reject(signal.reason)),
      );
    assert.equal(
      await reachable("https://example.test/", {
        fetch: waitForAbort,
        timeout: 1,
      }),
      false,
    );
  });
});

describe("keeping Semgrep's rules", () => {
  const rules = '{"rules":[{"id":"example.rule"}]}';

  it("writes the rules that arrived to the file", async () => {
    const file = join(folder(), "rules.yaml");
    await keepRules("https://example.test/rules", file, {
      fetch: answering(200, rules),
    });
    assert.equal(readFileSync(file, "utf8"), rules);
    assert.equal(existsSync(`${file}.partial`), false);
  });

  for (const [what, body] of [
    ["no rules", '{"rules":[]}'],
    ["no list of rules", '{"rule":"example"}'],
    ["something other than JSON", "<html></html>"],
  ])
    it(`keeps the earlier copy when the answer holds ${what}`, async () => {
      const file = join(folder(), "rules.yaml");
      writeFileSync(file, "earlier\n");
      await assert.rejects(
        keepRules("https://example.test/rules", file, {
          fetch: answering(200, body),
        }),
        /https:\/\/example\.test\/rules sent no rules/,
      );
      assert.equal(readFileSync(file, "utf8"), "earlier\n");
    });

  it("keeps the earlier copy when the address refuses", async () => {
    const file = join(folder(), "rules.yaml");
    writeFileSync(file, "earlier\n");
    await assert.rejects(
      keepRules("https://example.test/rules", file, {
        fetch: answering(404),
      }),
      /https:\/\/example\.test\/rules answered 404/,
    );
    assert.equal(readFileSync(file, "utf8"), "earlier\n");
  });

  it("keeps the earlier copy when there is no connection", async () => {
    const file = join(folder(), "rules.yaml");
    writeFileSync(file, "earlier\n");
    await assert.rejects(
      keepRules("https://example.test/rules", file, { fetch: failing }),
    );
    assert.equal(readFileSync(file, "utf8"), "earlier\n");
  });
});

describe("finding the Ryuk image", () => {
  const source =
    'return env ? x : ImageName.fromString("testcontainers/ryuk:9.8.7").string;';

  it("reads the image Testcontainers names", () => {
    assert.equal(ryukImage(source, {}), "testcontainers/ryuk:9.8.7");
  });

  it("takes the image RYUK_CONTAINER_IMAGE names instead", () => {
    assert.equal(
      ryukImage(source, { RYUK_CONTAINER_IMAGE: "mirror.test/ryuk:1.0.0" }),
      "mirror.test/ryuk:1.0.0",
    );
  });

  it("fails when Testcontainers names none", () => {
    assert.throws(
      () => ryukImage("no image here", {}),
      /Could not find the Ryuk image in Testcontainers/,
    );
  });

  it("finds an image in the Testcontainers installed", () => {
    assert.match(
      ryukImage(reaperSource(), {}),
      /^testcontainers\/ryuk:\d+\.\d+\.\d+$/,
    );
  });
});
