// SPDX-License-Identifier: Apache-2.0

// Tests for combining container image scan reports, including missing or unreadable reports, which
// must be recorded so the security report cannot pass without them.

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { combineImageReports } from "./combine-image-reports.mjs";

describe("combining image reports", () => {
  it("pairs each image with its parsed report", () => {
    const files = new Map([["/a.json", '{"SchemaVersion":2}']]);
    assert.deepEqual(
      combineImageReports(["example/image:1=/a.json"], (path) =>
        files.get(path),
      ),
      [{ image: "example/image:1", report: { SchemaVersion: 2 } }],
    );
  });

  it("keeps an image whose name contains an equals sign intact", () => {
    assert.deepEqual(
      combineImageReports(["a=b:1=/a.json"], () => "{}"),
      [{ image: "a=b:1", report: {} }],
    );
  });

  it("records a missing or unreadable report as null", () => {
    const result = combineImageReports(
      ["example/image:1=/missing.json", "other:1=/bad.json"],
      (path) => {
        if (path === "/bad.json") return "not json";
        throw new Error("missing");
      },
    );
    assert.deepEqual(result, [
      { image: "example/image:1", report: null },
      { image: "other:1", report: null },
    ]);
  });

  it("returns an empty list when no images were scanned", () => {
    assert.deepEqual(
      combineImageReports([], () => "{}"),
      [],
    );
  });
});
