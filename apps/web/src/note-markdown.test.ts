// SPDX-License-Identifier: Apache-2.0

// Tests for a note's Markdown as the note editor's document and back, which the editor and the
// Markdown view rely on to edit the same note.

import { cleanNote, colourTag } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { docToNote, noteToDoc } from "./note-markdown.ts";

const teal = colourTag("teal");
const red = colourTag("red");

const notes = [
  `Plain **bold** _italic_ ~~struck~~ \`code\` [site](https://example.com/) and ${teal}teal **bold**</span>.`,
  "- One\n  - Nested\n- Two\n\nAfter",
  "First\\\nsecond",
  "**[Bold link](https://example.com/)** and [**inner**](https://example.test/)",
  `${red}red ${teal}teal</span> red</span>`,
  "**_`all three`_**",
  "",
  "\\<script> and \\*not bold\\*",
  "# One\n\n## Two\n\n### Three\n\n- [ ] Open\n- [x] Done\n  - [ ] Nested",
];

const text = (value: string, marks?: { type: string }[]) => ({
  type: "text",
  text: value,
  ...(marks === undefined ? {} : { marks }),
});
const doc = (...content: object[]) => ({ type: "doc", content });

const trip = (markdown: string) => docToNote(noteToDoc(markdown));

describe("a note in the editor", () => {
  it.each(notes)(
    "keeps the document %j makes, through Markdown and back",
    (note) => {
      const doc = noteToDoc(cleanNote(note));
      expect(noteToDoc(docToNote(doc))).toEqual(doc);
    },
  );

  it.each(notes)("writes %j the way it keeps it after one trip", (note) => {
    const once = trip(cleanNote(note));
    expect(trip(once)).toBe(once);
  });

  it("keeps a note written as the editor writes it as it is", () => {
    const note = `Plain **bold** [site](https://example.com/) ${teal}teal</span>\n\n- One`;
    expect(trip(note)).toBe(note);
  });

  it("writes a colour within another as colours one after the other", () => {
    expect(trip(`${red}red ${teal}teal</span> red</span>`)).toBe(
      `${red}red </span>${teal}teal</span>${red} red</span>`,
    );
  });

  it("writes formatting around a link within the link", () => {
    expect(trip("**[Bold link](https://example.com/)**")).toBe(
      "[**Bold link**](https://example.com/)",
    );
  });

  it("leaves out list items with nothing in them, and a list of only those", () => {
    const item = (checked: boolean, ...content: object[]) => ({
      type: "taskItem",
      attrs: { checked },
      content,
    });
    expect([
      docToNote(
        doc({
          type: "taskList",
          content: [
            item(true, { type: "paragraph", content: [text("Met")] }),
            item(false, { type: "paragraph" }),
          ],
        }),
      ),
      docToNote(
        doc({
          type: "bulletList",
          content: [{ type: "listItem", content: [{ type: "paragraph" }] }],
        }),
      ),
    ]).toEqual(["- [x] Met", ""]);
  });

  it("gives an empty list item an empty paragraph", () => {
    expect(noteToDoc("- One\n-").content?.[0]?.content?.[1]).toEqual({
      type: "listItem",
      content: [{ type: "paragraph" }],
    });
  });

  it("leaves out line breaks at either end of a paragraph, and makes a heading's spaces", () => {
    const breakNode = { type: "hardBreak" };
    expect(
      docToNote(
        doc(
          {
            type: "paragraph",
            content: [
              breakNode,
              text("One"),
              breakNode,
              text("two"),
              breakNode,
            ],
          },
          {
            type: "heading",
            attrs: { level: 3 },
            content: [text("Three"), breakNode, text("four")],
          },
        ),
      ),
    ).toBe("One\\\ntwo\n\n### Three four");
  });

  it("writes spaces at the ends of bold text outside it, and keeps code's", () => {
    expect(
      docToNote(
        doc({
          type: "paragraph",
          content: [
            text("a"),
            text(" b ", [{ type: "bold" }]),
            text("c"),
            text(" d ", [{ type: "code" }]),
            text("  ", [{ type: "italic" }]),
            text("e"),
          ],
        }),
      ),
    ).toBe("a **b** c`  d  `  e");
  });

  it("keeps a colour around nothing as an empty paragraph", () => {
    expect(noteToDoc(`${teal}</span>`)).toEqual({
      type: "doc",
      content: [{ type: "paragraph" }],
    });
  });

  it("starts an empty note with an empty paragraph", () => {
    expect([noteToDoc(""), docToNote(noteToDoc(""))]).toEqual([
      { type: "doc", content: [{ type: "paragraph" }] },
      "",
    ]);
  });

  it("holds text, line breaks, marks, and lists as the editor names them", () => {
    expect(
      noteToDoc(`**Bold** ${teal}\`code\`</span>\\\nnext\n\n- One`),
    ).toEqual({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [
            { type: "text", text: "Bold", marks: [{ type: "bold" }] },
            { type: "text", text: " " },
            {
              type: "text",
              text: "code",
              marks: [
                { type: "colour", attrs: { colour: "teal" } },
                { type: "code" },
              ],
            },
            { type: "hardBreak" },
            { type: "text", text: "next" },
          ],
        },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                { type: "paragraph", content: [{ type: "text", text: "One" }] },
              ],
            },
          ],
        },
      ],
    });
  });
});
