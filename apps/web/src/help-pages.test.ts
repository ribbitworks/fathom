// SPDX-License-Identifier: Apache-2.0

// Tests for Help's pages as the front end builds them in: each page's name, title, text and
// diagrams, where a link to one goes, and that every page and drawing in docs/help is built in, in
// the note format or safe to draw, with each link leading to a page and heading that exist.

import { helpLink, noteFormatProblem, parseNote } from "@fathom/shared";
import GithubSlugger from "github-slugger";
import type { Nodes } from "mdast";
import { readdirSync, readFileSync } from "node:fs";
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
  withoutStyle,
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

const textsOf = (name: string) =>
  (helpPage(name)?.parts ?? []).flatMap((part) =>
    part.kind === "text" ? [part.markdown] : [],
  );

const drawingsOf = (name: string) =>
  (helpPage(name)?.parts ?? []).flatMap((part) =>
    part.kind === "diagram" ? [part.drawing] : [],
  );

// Each heading's anchor on a page, as it is shown: each text between diagrams is drawn on its own.
const anchorsOf = (name: string): string[] =>
  textsOf(name).flatMap((text) => {
    const slugger = new GithubSlugger();
    return parseNote(text)
      .children.filter((node) => node.type === "heading")
      .map((heading) => slugger.slug(words(heading)));
  });

const drawingsFolder = join(import.meta.dirname, "../../../docs/help/diagrams");

describe("a Help page", () => {
  it("is named by its file, titled by its first line, and holds the rest", () => {
    expect(
      readHelpPage(
        "../../../docs/help/saved-views.md",
        "# Saved views\n\nText",
      ),
    ).toEqual({
      name: "saved-views",
      title: "Saved views",
      parts: [{ kind: "text", markdown: "Text" }],
    });
  });

  it("is titled by its name when it has no title", () => {
    expect(readHelpPage("lists.md", "Text")).toEqual({
      name: "lists",
      title: "lists",
      parts: [{ kind: "text", markdown: "Text" }],
    });
  });

  it("shows each diagram on a line of its own as its drawing, between its text", () => {
    expect(
      readHelpPage(
        "lists.md",
        "# Lists\n\nBefore\n\n![A](diagrams/a.svg)\n\nBetween\n\n![B](diagrams/b.svg)\n",
        new Map([
          ["a.svg", "<svg>A</svg>"],
          ["b.svg", "<svg>B</svg>"],
        ]),
      ).parts,
    ).toEqual([
      { kind: "text", markdown: "Before\n\n" },
      { kind: "diagram", drawing: "<svg>A</svg>" },
      { kind: "text", markdown: "\n\nBetween\n\n" },
      { kind: "diagram", drawing: "<svg>B</svg>" },
    ]);
  });

  it("keeps an image within a line as text", () => {
    expect(
      readHelpPage("lists.md", "See ![A](diagrams/a.svg) here").parts,
    ).toEqual([{ kind: "text", markdown: "See ![A](diagrams/a.svg) here" }]);
  });

  it("stops a build without a diagram's drawing", () => {
    expect(() => readHelpPage("lists.md", "![A](diagrams/a.svg)\n")).toThrow(
      "docs/help/diagrams/a.svg is missing.",
    );
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

describe("a drawing shown in Help", () => {
  it("leaves out every style block of its own, whatever its attributes", () => {
    expect(
      withoutStyle(
        '<svg><style type="text/css">a{}</style><g/><style>\nb{}\n</style></svg>',
      ),
    ).toBe("<svg><g/></svg>");
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

  it.each(names)(
    "%s.md has a title and, besides its diagrams, is in the note format",
    (name) => {
      const page = helpPage(name);
      expect(page?.title).not.toBe(name);
      // Help pages may be longer than a note may be, but hold only what notes allow.
      const problems = (page?.parts ?? []).map((part) =>
        part.kind === "text" ? noteFormatProblem(part.markdown) : undefined,
      );
      expect(problems.filter((problem) => problem !== undefined)).toEqual([]);
    },
  );

  it.each(readdirSync(drawingsFolder))(
    "draws diagrams/%s on a page, safely, in Fathom's colours alone",
    (file) => {
      const drawing = readFileSync(join(drawingsFolder, file), "utf8");
      const shown = names.flatMap(drawingsOf);
      expect(shown).toContain(withoutStyle(drawing));
      expect(withoutStyle(drawing)).not.toMatch(
        /<style|<script|<foreignObject|\son\w+=/iu,
      );
      // Ids are the page's, so they stay apart from other drawings' and from headings' anchors.
      const ids = [...drawing.matchAll(/\sid="(?<id>[^"]+)"/gu)].map(
        (found) => found.groups?.id,
      );
      const prefix = `${file.replace(/\.svg$/u, "")}-`;
      expect(ids.filter((id) => !id?.startsWith(prefix))).toEqual([]);
    },
  );

  it.each(names)(
    "%s.md links only to Help pages and headings that exist",
    (name) => {
      const links = textsOf(name).flatMap((text) => linksIn(parseNote(text)));
      const missing = links.filter((address) => {
        const link = helpLink(address);
        const target = link && helpPage(link.page);
        return (
          target === undefined ||
          (link?.heading !== undefined &&
            !anchorsOf(target.name).includes(link.heading))
        );
      });
      expect(missing).toEqual([]);
    },
  );
});
