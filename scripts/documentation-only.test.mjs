// SPDX-License-Identifier: Apache-2.0

// Tests of deciding whether a change is documentation alone: Markdown and docs/ are, Help pages,
// code, settings and workflows aren't, nor is a mix of both.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isDocumentationOnly } from "./documentation-only.mjs";

describe("whether a change is documentation alone", () => {
  it("is when only Markdown and other files under docs/ changed", () => {
    assert.equal(
      isDocumentationOnly([
        "docs/standards/testing.md",
        "README.md",
        "docs/design/pages/org-chart.png",
      ]),
      true,
    );
  });

  it("isn't when a Help page changed, since they are built into the web app", () => {
    assert.equal(isDocumentationOnly(["docs/help/lists.md"]), false);
  });

  it("isn't when code, settings, scripts or a workflow changed beside documentation", () => {
    for (const path of [
      "apps/server/src/app.ts",
      "deploy/compose.yaml",
      "pnpm-lock.yaml",
      "scripts/lib.sh",
      ".github/workflows/check.yml",
      "renovate.json",
    ]) {
      assert.equal(isDocumentationOnly(["README.md", path]), false, path);
    }
  });

  it("is when nothing changed", () => {
    assert.equal(isDocumentationOnly([]), true);
  });
});
