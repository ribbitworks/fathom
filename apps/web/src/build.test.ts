// SPDX-License-Identifier: Apache-2.0

// Builds the front end and checks the result works under the server's security policy, which
// allows scripts and styles only from Fathom's own files: nothing inline, no code built from
// strings, and nothing from other sites.

// @vitest-environment node

import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { build } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

let outDir: string;
let page: string;

beforeAll(async () => {
  outDir = mkdtempSync(join(tmpdir(), "fathom-web-build-"));
  await build({
    root: join(import.meta.dirname, ".."),
    logLevel: "silent",
    build: { outDir },
  });
  page = readFileSync(join(outDir, "index.html"), "utf8");
}, 60_000);

afterAll(() => {
  rmSync(outDir, { recursive: true, force: true });
});

describe("built front end", () => {
  it("loads its script and stylesheet from Fathom's own files", () => {
    expect(page).toMatch(
      /<script type="module" crossorigin src="\/assets\/[^"]+\.js">/,
    );
    expect(page).toMatch(
      /<link rel="stylesheet" crossorigin href="\/assets\/[^"]+\.css">/,
    );
  });

  it("has no inline scripts or styles, which the security policy would block", () => {
    expect(page).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>/);
    expect(page).not.toMatch(/<style|\sstyle=/);
  });

  it("does not build code from strings, which the security policy would block", () => {
    const scripts = readdirSync(join(outDir, "assets"))
      .filter((file) => file.endsWith(".js"))
      .map((file) => readFileSync(join(outDir, "assets", file), "utf8"));
    expect(scripts).not.toHaveLength(0);
    for (const script of scripts) {
      expect(script).not.toMatch(/\beval\(|new Function\(/);
    }
  });

  it("loads nothing from other sites", () => {
    expect(page).not.toMatch(/(src|href)="https?:/);
    expect(page).not.toMatch(/(src|href)="\/\//);
    const stylesheets = readdirSync(join(outDir, "assets"))
      .filter((file) => file.endsWith(".css"))
      .map((file) => readFileSync(join(outDir, "assets", file), "utf8"));
    expect(stylesheets).not.toHaveLength(0);
    for (const stylesheet of stylesheets) {
      expect(stylesheet).not.toMatch(/@import/);
      expect(stylesheet).not.toMatch(/url\(["']?https?:/);
      expect(stylesheet).not.toMatch(/url\(["']?\/\//);
    }
  });
});
