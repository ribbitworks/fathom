// SPDX-License-Identifier: Apache-2.0

// Tests for Vite's development server: it serves the front end's own files, and refuses files
// elsewhere in the repository, such as the development secrets in .dev/ and the private/ folder.

// @vitest-environment node

import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createServer, type ViteDevServer } from "vite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const webFolder = join(import.meta.dirname, "..");
const repositoryRoot = join(webFolder, "..", "..");
let server: ViteDevServer;
let url: string;
// A fictional file outside the front end, in the repository's git-ignored .tmp/ folder.
let outsideFolder: string;
let outsideFile: string;

beforeAll(async () => {
  mkdirSync(join(repositoryRoot, ".tmp"), { recursive: true });
  outsideFolder = mkdtempSync(join(repositoryRoot, ".tmp", "dev-server-"));
  outsideFile = join(outsideFolder, "outside.txt");
  writeFileSync(outsideFile, "fictional-outside-marker");
  // A free port, without opening the browser.
  server = await createServer({
    root: webFolder,
    logLevel: "silent",
    server: { port: 0, open: false },
  });
  await server.listen();
  url = String(server.resolvedUrls?.local[0]);
});

afterAll(async () => {
  await server.close();
  rmSync(outsideFolder, { recursive: true, force: true });
});

describe("development server", () => {
  it("serves the front end's own files", async () => {
    expect((await fetch(`${url}src/app.tsx`)).status).toBe(200);
  });

  it("refuses files elsewhere in the repository", async () => {
    for (const file of [join(repositoryRoot, "package.json"), outsideFile]) {
      const response = await fetch(`${url}@fs${file}`);
      expect(response.status).toBe(403);
      expect(await response.text()).not.toContain("fictional-outside-marker");
    }
  });
});
