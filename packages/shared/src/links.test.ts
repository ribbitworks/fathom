// SPDX-License-Identifier: Apache-2.0

// Tests for web links: which addresses Fathom accepts and the form it keeps them in, what is wrong
// with a link, a link as a request sends it, and how a link is shown in words.

import { describe, expect, it } from "vitest";
import {
  addressProblem,
  isLink,
  linkInWords,
  linkLabel,
  linkProblems,
  keptAddress,
  linkValueSchema,
  noteAddress,
  shortAddress,
  shownLinkText,
  webAddress,
} from "./links.ts";

const web = "https://proposals.example.test/P-1";
const proposal = { address: web, text: "P-1 proposal" };
const rightToLeft = String.fromCodePoint(0x202e);

describe("web addresses", () => {
  it.each([
    [` ${web} `, web],
    ["http://intranet.example.test", "http://intranet.example.test/"],
    ["example.com", "https://example.com/"],
    [" www.example.com/news#top ", "https://www.example.com/news#top"],
    ["intranet.example.test:8080/a", "https://intranet.example.test:8080/a"],
    ["HTTPS://Example.COM/News", "https://example.com/News"],
    ["https://example.com/a b", "https://example.com/a%20b"],
    [
      `https://example.com/${rightToLeft}txt`,
      "https://example.com/%E2%80%AEtxt",
    ],
    ["bücher.example", "https://xn--bcher-kva.example/"],
    ["https:\\\\proposals.example.test", "https://proposals.example.test/"],
  ])("accepts %j, kept as %s", (typed, kept) => {
    expect(webAddress(typed)).toBe(kept);
  });

  it.each([
    ["http://wiki/", "http://wiki/"],
    ["https://wiki/Proposals", "https://wiki/Proposals"],
    ["http://10.0.0.5/reports", "http://10.0.0.5/reports"],
    ["http://[fd00::5]:8080/", "http://[fd00::5]:8080/"],
    ["https://files_01.example.test/", "https://files_01.example.test/"],
    ["http://[2001:db8::1]/", "http://[2001:db8::1]/"],
    ["https://my_host.example.com./", "https://my_host.example.com./"],
  ])(
    "accepts the intranet host or IP address %j when its scheme is typed",
    (typed, kept) => {
      expect(webAddress(typed)).toBe(kept);
    },
  );

  it.each([
    "wiki",
    "proposals/P-1",
    "localhost:3000",
    "10",
    "//proposals.example.test/P-1",
    "wiki\\example.com",
  ])(
    "refuses %j, typed without its scheme and with no dot in its host",
    (typed) => {
      expect(webAddress(typed)).toBeNull();
    },
  );

  it.each([
    "javascript:alert(1)",
    "JAVASCRIPT:alert(1)",
    "java\tscript:alert(1)",
    "javascript:1",
    "vbscript:msgbox(1)",
    "data:text/html,hello",
    "mailto:someone@example.com",
    "ftp://files.example.test/",
    "file://files.example.test/Proposals",
    "FILE://files.example.test/Proposals",
    "\\\\files.example.test\\Proposals",
    "P:\\Proposals",
    "https://",
    "https://user@proposals.example.test",
    "https://user:secret@proposals.example.test",
    "proposals.example.test@elsewhere.test",
    "user@example.test",
    "https://-proposals.example.test/",
    "https://proposals-.example.test/",
    "",
  ])("refuses %j", (typed) => {
    expect(webAddress(typed)).toBeNull();
  });
});

describe("a note's addresses", () => {
  it.each([
    [" lists.md ", "lists.md"],
    ["saved-views.md#share-a-view", "saved-views.md#share-a-view"],
    ["example.com", "https://example.com/"],
    ["Lists.md", null],
    ["/help/lists#add-choices", "lists.md#add-choices"],
    ["/help", "index.md"],
    ["/helpful", null],
    ["https://lists.md/", "https://lists.md/"],
    ["../help/lists.md", null],
    ["lists.md#", null],
    ["javascript:alert(1)", null],
  ])("keeps %j as %j", (typed, kept) => {
    expect(noteAddress(typed)).toBe(kept);
  });
});

describe("a link's problems", () => {
  it("are none for a link Fathom accepts", () => {
    expect(linkProblems(proposal)).toEqual({});
  });

  it("ask for a missing address", () => {
    expect(linkProblems({ address: " ", text: "P-1" })).toEqual({
      address: "Address needed",
    });
  });

  it("explain a refused address", () => {
    expect(linkProblems({ address: "proposals/P-1", text: "" })).toEqual({
      address: addressProblem,
    });
  });

  it("take a Help page only in a note, and a web address on .md in a column", () => {
    expect([
      keptAddress("lists.md", "column"),
      keptAddress("lists.md", "note"),
    ]).toEqual(["https://lists.md/", "lists.md"]);
  });

  it("explain an address a note refuses", () => {
    expect(linkProblems({ address: "lists", text: "" }, "note")).toEqual({
      address: `${addressProblem}, or a Help page, such as lists.md`,
    });
  });

  it("name the address as too long", () => {
    expect(
      linkProblems({ address: `${web}/${"x".repeat(2000)}`, text: "" }),
    ).toEqual({
      address: "Address is too long",
    });
  });

  it("name the address as too long once kept, as when https:// is added to it", () => {
    const typed = `example.test/${"x".repeat(1987)}`;
    expect(typed).toHaveLength(2000);
    expect(linkProblems({ address: typed, text: "" })).toEqual({
      address: "Address is too long",
    });
  });

  it("name the text as too long", () => {
    expect(linkProblems({ address: web, text: "x".repeat(201) })).toEqual({
      text: "Text to show is too long",
    });
  });

  // Marks that change which way text runs could make the address beside it read as another.
  it.each([
    ["a right-to-left override", `P-1${rightToLeft}fdp.exe`],
    ["a control character", `P-1${String.fromCodePoint(0)}`],
    ["a line break", "P-1\nP-2"],
  ])("refuse text with %s", (_name, text) => {
    expect(linkProblems({ address: web, text })).toEqual({
      text: "Use plain text, without control characters",
    });
  });

  it("accept text with emoji joined by format characters", () => {
    expect(linkProblems({ address: web, text: "Docs 👩‍💻" })).toEqual({});
  });
});

describe("a link as a request sends it", () => {
  it("is kept with its address as Fathom keeps it, and its text trimmed", () => {
    expect(
      linkValueSchema.parse({ address: "example.com", text: " Example " }),
    ).toEqual({ address: "https://example.com/", text: "Example" });
  });

  it("is refused, naming the field, when its address is not accepted", () => {
    const parsed = linkValueSchema.safeParse({
      address: "javascript:alert(1)",
      text: "",
    });
    expect(parsed.error?.issues).toEqual([
      expect.objectContaining({ path: ["address"], message: addressProblem }),
    ]);
  });
});

describe("a link in words", () => {
  it("shows its text when it has some", () => {
    expect(linkLabel(proposal)).toBe("P-1 proposal");
  });

  it.each([
    ["https://amazon.example.test/", "amazon.example.test"],
    ["https://www.amazon.example.test/deals?page=2", "amazon.example.test"],
    ["http://wiki/", "wiki"],
    [web, "proposals.example.test"],
    [
      "https://reports.example.test:8443/2026/q3?view=all#totals",
      "reports.example.test:8443",
    ],
  ])("shows only the host of %s when it has no text", (address, shown) => {
    expect(linkLabel({ address, text: "" })).toBe(shown);
  });

  it("names its address beside its text, as drafts and the history show it", () => {
    expect(linkInWords(proposal)).toBe(`P-1 proposal (${web})`);
    expect(linkInWords({ address: web, text: "" })).toBe(web);
  });
});

describe("a link's host and shape", () => {
  it("tells a link from other values", () => {
    expect(isLink({ address: "https://example.com/", text: "" })).toBe(true);
    expect(isLink("https://example.com/")).toBe(false);
  });

  it("shortens an address to its host, without www.", () => {
    expect(shortAddress("https://www.example.com/a?b#c")).toBe("example.com");
    expect(shortAddress("HTTP://wiki")).toBe("wiki");
  });

  it("shows text that only repeats its address as the host, and other text as it is", () => {
    expect(
      [
        ["https://www.example.com/news", "https://www.example.com/news"],
        ["http://example.com", "Example.com/"],
        ["https://example.com/news", "example.com/other"],
        ["https://example.com/", "Site"],
        ["https://example.com/Plan", "EXAMPLE.com/Plan"],
        ["https://example.com/Plan", "example.com/plan"],
        ["https://example.com/?a", "example.com?a"],
      ].map(([address, text]) =>
        shownLinkText(address as string, text as string),
      ),
    ).toEqual([
      "example.com",
      "example.com",
      "example.com/other",
      "Site",
      "example.com",
      "example.com/plan",
      "example.com?a",
    ]);
  });
});
