// SPDX-License-Identifier: Apache-2.0

// Tests for Help's pages as the front end builds them in: each page's name, title and text, where a
// link to one goes, and that every page in docs/help, as it is now, is built in and in the note
// format, with each link between pages leading to a page, and a heading on it, that exists.

import { helpLink, noteFormatProblem, parseNote } from "@fathom/shared";
import GithubSlugger from "github-slugger";
import type { Nodes } from "mdast";
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  helpDestination,
  helpIndex,
  helpIndexPage,
  helpPage,
  helpPageNames,
  readHelpPage,
  requiredIndex,
  shownHelpPage,
} from "./help-pages.ts";

const words = (node: Nodes): string =>
  "value" in node
    ? node.value
    : "children" in node
      ? node.children.map(words).join("")
      : "";

const linksIn = (node: Nodes): string[] =>
  node.type === "link"
    ? [node.url]
    : "children" in node
      ? node.children.flatMap(linksIn)
      : [];

// Each heading's anchor on a page, as it is shown.
function anchorsOf(body: string): string[] {
  const slugger = new GithubSlugger();
  return parseNote(body)
    .children.filter((node) => node.type === "heading")
    .map((heading) => slugger.slug(words(heading)));
}

describe("a Help page", () => {
  it("is named by its file, titled by its first line, and holds the rest", () => {
    expect(
      readHelpPage(
        "../../../docs/help/saved-views.md",
        "# Saved views\n\nText",
      ),
    ).toEqual({ name: "saved-views", title: "Saved views", body: "Text" });
  });

  it("is titled by its name when it has no title", () => {
    expect(readHelpPage("lists.md", "Text")).toEqual({
      name: "lists",
      title: "lists",
      body: "Text",
    });
  });

  it("is shown at its own address, except the index, which has Help's", () => {
    expect([shownHelpPage("lists")?.title, shownHelpPage("index")]).toEqual([
      "Lists",
      undefined,
    ]);
  });

  it("stops a build without an index", () => {
    expect(() => requiredIndex(undefined)).toThrow(
      "docs/help/index.md is missing, so Help has no index.",
    );
  });

  it("is found by its name, and only when it exists", () => {
    expect([helpPage("lists")?.title, helpPage("no-such-page")]).toEqual([
      "Lists",
      undefined,
    ]);
  });
});

describe("where a link to a Help page goes", () => {
  it.each([
    ["index.md", { to: "/help" }],
    ["index.md#plan", { to: "/help", hash: "plan" }],
    ["lists.md", { to: "/help/$page", params: { page: "lists" } }],
    [
      "lists.md#add-choices",
      { to: "/help/$page", params: { page: "lists" }, hash: "add-choices" },
    ],
  ])("goes from %j to %j", (address, destination) => {
    expect(
      helpDestination(helpLink(address) ?? { page: "", heading: "" }),
    ).toEqual(destination);
  });
});

describe("every Help page built in", () => {
  const names = helpPageNames();

  it("is every page in docs/help, as it is now, however the tests' compiled files were cached", () => {
    const onDisk = readdirSync(join(import.meta.dirname, "../../../docs/help"))
      .filter((file) => file.endsWith(".md"))
      .map((file) => file.replace(/\.md$/u, ""));
    expect([...names].sort()).toEqual(onDisk.sort());
  });

  it("includes the index", () => {
    expect([names.includes(helpIndex), helpIndexPage.title]).toEqual([
      true,
      "Help",
    ]);
  });

  it.each(names)("%s.md has a title and is in the note format", (name) => {
    const page = helpPage(name);
    expect(page?.title).not.toBe(name);
    // Help pages may be longer than a note may be, but hold only what notes allow.
    expect(noteFormatProblem(page?.body ?? "")).toBeUndefined();
  });

  it.each(names)(
    "%s.md links only to Help pages and headings that exist",
    (name) => {
      const links = linksIn(parseNote(helpPage(name)?.body ?? ""));
      const missing = links.filter((address) => {
        const link = helpLink(address);
        const target = link && helpPage(link.page);
        return (
          target === undefined ||
          (link?.heading !== undefined &&
            !anchorsOf(target.body).includes(link.heading))
        );
      });
      expect(missing).toEqual([]);
    },
  );
});
