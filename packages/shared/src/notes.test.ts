// SPDX-License-Identifier: Apache-2.0

// Tests for notes kept as Markdown: what a note may hold, how typed and pasted text is cleaned to
// that, and a note's words as a preview shows them.

import { describe, expect, it } from "vitest";
import {
  isNoteField,
  cleanNote,
  noteFormatProblem,
  colourTag,
  isNoteColour,
  noteLength,
  notePlainText,
  toggleCheckbox,
  noteProblem,
} from "./notes.ts";

const teal = colourTag("teal");

// Every note the tests below refuse or clean, so cleaning each can be checked to give a note kept.
const testedNotes: string[] = [];

describe("a note", () => {
  it("may hold every format notes allow", () => {
    expect(
      noteProblem(
        `Plain **bold** _italic_ ~~struck~~ \`code\` [site](https://example.com/) [Lists](lists.md) [Add choices](lists.md#add-choices) ${teal}teal **bold**</span>\\\nnext line\n\n# One\n\n## Two\n\n### Three\n\n- one\n  - nested\n- two\n\nTasks\n\n- [ ] open\n- [x] done\n  - [ ] nested\n\nSteps\n\n1. first\n   - bullet\n2. second\n   1. nested\n3. third\n   - [ ] task`,
      ),
    ).toBeUndefined();
  });

  it.each([
    ["#### Deep", "A note's headings go three levels deep at most."],
    ["- One\n\n  # Heading", "A note's lists can't hold headings."],
    [
      "# Heading <mark>x</mark>",
      "A note can only colour text from its palette.",
    ],
    ["> Quoted", "A note can't hold quotes."],
    ["```\ncode\n```", "A note can't hold code blocks."],
    ["![Picture](https://example.com/a.png)", "A note can't hold images."],
    ["| a |\n| - |\n| 1 |", "A note can't hold tables."],
    ["One\n\n---", "A note can't hold lines across."],
    ["<div>Block</div>", "A note can't hold HTML."],
    ["Text[^1]\n\n[^1]: Note", "A note can't hold footnotes."],
    [
      "[Site][site]\n\n[site]: https://example.com/",
      "A note can't hold reference links.",
    ],
    ["3. One\n4. Two", "A note's numbered lists start at 1."],
    ["- One\n\n  0. Inner", "A note's numbered lists start at 1."],
    ["1. [ ] Task", "A numbered list's items can't have checkboxes."],
    [
      "- [ ] Task\n- Plain",
      "A list's items must all have checkboxes, or none.",
    ],
    ["- One\n\n  ```\n  code\n  ```", "A note can't hold code blocks."],
    [
      "Text with <mark>highlight</mark>",
      "A note can only colour text from its palette.",
    ],
    [
      '<span data-colour="sea">Sea</span> text',
      "A note can only colour text from its palette.",
    ],
    [
      'Text <span style="color: red">red</span>',
      "A note can only colour text from its palette.",
    ],
    [`Text ${teal}open`, "A note's colours must close."],
    ["Text </span> closed", "A note's colours must open before they close."],
    [
      "[Run](javascript:alert(1))",
      "A note's links must be web addresses, starting with http or https, or Help pages, such as lists.md.",
    ],
    [
      '[Site](https://example.com/ "Title")',
      "A note's links must be web addresses, starting with http or https, or Help pages, such as lists.md.",
    ],
    [
      "[Up](../help/lists.md)",
      "A note's links must be web addresses, starting with http or https, or Help pages, such as lists.md.",
    ],
    [
      "Text **with ![image](https://example.com/a.png)**",
      "A note can't hold images.",
    ],
  ])("may not hold %j", (markdown, problem) => {
    testedNotes.push(markdown);
    expect(noteProblem(markdown)).toBe(problem);
  });

  it("is checked for its format alone, whatever its length", () => {
    expect([
      noteFormatProblem("a".repeat(noteLength + 1)),
      noteFormatProblem("> Quoted"),
    ]).toEqual([undefined, "A note can't hold quotes."]);
  });

  it("is at most its length", () => {
    expect([
      noteProblem("a".repeat(noteLength)),
      noteProblem("a".repeat(noteLength + 1)),
    ]).toEqual([undefined, "A note can be at most 10,000 characters."]);
  });
});

describe("cleaning a note", () => {
  it.each([
    ["# Heading\n\n> Quoted", "# Heading\n\nQuoted"],
    ["###### Deep", "### Deep"],
    ["#", ""],
    ["- One\n\n  ## Inside", "- One\n\n  Inside"],
    ["- [x] Done\n- Plain", "- [x] Done\n- [ ] Plain"],
    ["- [ ] Open\n-", "- [ ] Open"],
    ["- Item\n-", "- Item"],
    ["-", ""],
    ["1. One\n2. Two", "1. One\n2. Two"],
    ["3) One\n4) Two", "1. One\n2. Two"],
    ["- One\n\n  5. Inner", "- One\n  1. Inner"],
    ["1. [x] Done\n2. Plain", "- [x] Done\n- [ ] Plain"],
    ["1. One\n   -", "1. One"],
    ["- [x] Done", "- [x] Done"],
    ["```\ncode\n```", "code"],
    ["![Picture](https://example.com/a.png) text", "Picture text"],
    ["![](https://example.com/a.png)", ""],
    ["| a | b |\n| - | - |\n| 1 | 2 |", "a b\n\n1 2"],
    ["One\n\n---\n\nTwo", "One\n\nTwo"],
    ["<div>Block</div>\n\nAfter", "After"],
    ["Text <mark>marked</mark> and <b>bold</b>", "Text marked and bold"],
    ['<span data-colour="sea">Sea</span> text', "Sea text"],
    [`${teal}Open only`, "Open only"],
    ["Close </span>only", "Close only"],
    ["[Run](javascript:alert(1)) here", "Run here"],
    ["[Site](example.com)", "[Site](https://example.com/)"],
    ["[Lists]( lists.md#add-choices )", "[Lists](lists.md#add-choices)"],
    ["[Lists](/help/lists)", "[Lists](lists.md)"],
    ["[Design](../design/conventions.md)", "Design"],
    ['[Site](https://example.com/ "Title")', "[Site](https://example.com/)"],
    ["[Site][site]\n\n[site]: https://example.com/", "Site"],
    ["Text[^1]\n\n[^1]: Footnote", "Text"],
    ["**Bold `code` ~~struck~~**", "**Bold `code` ~~struck~~**"],
  ])("makes %j into %j", (typed, cleaned) => {
    testedNotes.push(typed);
    expect(cleanNote(typed)).toBe(cleaned);
  });

  it("always gives a note that is kept", () => {
    expect(testedNotes.length).toBeGreaterThan(40);
    expect(
      testedNotes.filter(
        (typed) =>
          noteProblem(cleanNote(typed.slice(0, noteLength))) !== undefined,
      ),
    ).toEqual([]);
  });

  it("keeps the palette's colours", () => {
    const coloured = `Some ${teal}teal **text**</span>.`;
    expect(cleanNote(coloured)).toBe(coloured);
  });

  it("writes every note the same way, so cleaning it again changes nothing", () => {
    const cleaned = cleanNote("* One\n* Two\n\n__Bold__ *italic*");
    expect([cleaned, cleanNote(cleaned)]).toEqual([
      "- One\n- Two\n\n**Bold** _italic_",
      "- One\n- Two\n\n**Bold** _italic_",
    ]);
  });

  it("keeps text that looks like HTML as text", () => {
    const cleaned = cleanNote("\\<script>alert(1)\\</script>");
    expect([noteProblem(cleaned), notePlainText(cleaned)]).toEqual([
      undefined,
      "<script>alert(1)</script>",
    ]);
  });
});

describe("ticking a note's checkbox", () => {
  it("ticks or unticks the one at its place, nested ones counted in order, and leaves a note without it as it was", () => {
    const note = "- [ ] One\n  - [x] Inner\n- [ ] Two\n\nText";
    expect([
      toggleCheckbox(note, 0),
      toggleCheckbox(note, 1),
      toggleCheckbox(note, 2),
      toggleCheckbox(note, 3),
      toggleCheckbox(note, -1),
    ]).toEqual([
      "- [x] One\n  - [x] Inner\n- [ ] Two\n\nText",
      "- [ ] One\n  - [ ] Inner\n- [ ] Two\n\nText",
      "- [ ] One\n  - [x] Inner\n- [x] Two\n\nText",
      note,
      note,
    ]);
  });
});

describe("a note's words", () => {
  it("show a link's text, or, for a preview, a link that only repeats its address as the host", () => {
    const note =
      "Read https://www.example.com/news and [the plan](https://example.com/plan)";
    expect([notePlainText(note), notePlainText(note, true)]).toEqual([
      "Read https://www.example.com/news and the plan",
      "Read example.com and the plan",
    ]);
  });

  it("are worked out once for each note, keeping the latest notes'", () => {
    const notes = Array.from(
      { length: 2_001 },
      (_, at) => `Note ${String(at)}`,
    );
    expect(notes.map((note) => notePlainText(note)).at(-1)).toBe("Note 2000");
    expect(notePlainText("Note 0")).toBe("Note 0");
    expect(notePlainText("Note 2000")).toBe("Note 2000");
  });

  it("leave out formatting, with each paragraph and list item on a line of its own", () => {
    expect(
      notePlainText(
        `# Title\n\n**Bold** ${teal}teal</span> [site](https://example.com/)\\\nnext\n\n- one\n- [x] two`,
      ),
    ).toBe("Title\nBold teal site next\none\ntwo");
  });
});

describe("a note's colours", () => {
  it("are the palette's", () => {
    expect([
      isNoteColour("teal"),
      isNoteColour("sea"),
      isNoteColour(1),
    ]).toEqual([true, false, false]);
  });
});

describe("the fields that hold a note", () => {
  it("are a release's, a feature's and a customer's note, and no other field", () => {
    expect([
      isNoteField("release", "note"),
      isNoteField("feature", "note"),
      isNoteField("customer", "note"),
      isNoteField("customer", "description"),
      isNoteField("release", "name"),
      isNoteField("release-stream", "note"),
    ]).toEqual([true, true, true, false, false, false]);
  });
});
