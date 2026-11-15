// SPDX-License-Identifier: Apache-2.0

// Tests for links to Help pages: the page and heading an address names, and the addresses that
// name none.

import { describe, expect, it } from "vitest";
import {
  helpLink,
  helpLinkOfPath,
  isHelpLink,
  isMarkdownFile,
} from "./help-links.ts";

describe("a Help link", () => {
  it.each([
    ["lists.md", { page: "lists", heading: undefined }],
    [
      "saved-views.md#share-a-view",
      { page: "saved-views", heading: "share-a-view" },
    ],
  ])("names the page and heading of %j", (address, link) => {
    expect([helpLink(address), isHelpLink(address)]).toEqual([link, true]);
  });

  it.each([
    "../help/lists.md",
    "docs/help/lists.md",
    "Lists.md",
    "lists",
    "lists.md#",
    "-lists.md",
    "lists.md#Add",
    "lists.md#add#more",
    "https://example.com/lists.md",
  ])("names no Help page in %j", (address) => {
    expect([helpLink(address), isHelpLink(address)]).toEqual([
      undefined,
      false,
    ]);
  });
});

describe("Fathom's own address of a Help page", () => {
  it.each([
    ["/help", "index.md"],
    ["/help/", "index.md"],
    ["/help/lists", "lists.md"],
    ["/help/lists/", "lists.md"],
    ["/help/lists#add-choices", "lists.md#add-choices"],
  ])("makes %j the Help link %j", (address, link) => {
    expect(helpLinkOfPath(address)).toBe(link);
  });

  it.each([
    "/helpful",
    "/help/Lists",
    "/help/lists#Add",
    "/people",
    "lists.md",
  ])("makes no Help link of %j", (address) => {
    expect(helpLinkOfPath(address)).toBeUndefined();
  });
});

describe("a Markdown file's name", () => {
  it.each(["lists.md", "Lists.md", "lists.md#add", "Notes.MD"])(
    "is %j",
    (address) => {
      expect(isMarkdownFile(address)).toBe(true);
    },
  );

  it.each([
    "https://lists.md/",
    "../help/lists.md",
    "lists.mdx",
    "example.com",
  ])("is not %j", (address) => {
    expect(isMarkdownFile(address)).toBe(false);
  });
});
