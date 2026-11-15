// SPDX-License-Identifier: Apache-2.0

// What notes allow, as the browser holds it: the formats the note editor loads, so typing or pasting
// can make nothing else, and what the sanitiser lets through to the screen. Both follow the shared
// note format, which the server checks every note against.

import {
  headingLevels,
  isNoteColour,
  noteColours,
  webAddress,
} from "@fathom/shared";
import { getTaskListExtension } from "@mantine/tiptap";
import { Mark, mergeAttributes, wrappingInputRule } from "@tiptap/core";
import Bold from "@tiptap/extension-bold";
import Code from "@tiptap/extension-code";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Heading from "@tiptap/extension-heading";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import {
  BulletList,
  ListItem,
  ListKeymap,
  OrderedList,
  orderedListInputRegex,
  TaskItem,
  TaskList,
} from "@tiptap/extension-list";
import Paragraph from "@tiptap/extension-paragraph";
import Strike from "@tiptap/extension-strike";
import TextNode from "@tiptap/extension-text";
import { UndoRedo } from "@tiptap/extensions";
import type { Options } from "rehype-sanitize";

// The text shade of a palette colour, readable in light and dark mode alike.
export const colourText = (colour: string) =>
  `var(--mantine-color-${colour}-text)`;

// Text coloured from the palette, kept as the one tag notes allow for it. Pasted text keeps a
// colour only when it is the palette's.
const NoteColourMark = Mark.create({
  name: "colour",
  addAttributes() {
    return {
      colour: {
        parseHTML: (element) => element.getAttribute("data-colour"),
        renderHTML: (attributes: { colour: string }) => ({
          "data-colour": attributes.colour,
          style: `color: ${colourText(attributes.colour)}`,
        }),
      },
    };
  },
  parseHTML() {
    return [
      {
        tag: "span[data-colour]",
        getAttrs: (element) =>
          isNoteColour(element.getAttribute("data-colour")) ? null : false,
      },
    ];
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes), 0];
  },
});

// A numbered list always counts from 1 in plain numbers, as notes keep it, whatever number or
// style it is typed or pasted with.
const NoteOrderedList = OrderedList.extend({
  addAttributes: () => ({
    start: { default: 1, parseHTML: () => 1, renderHTML: () => ({}) },
  }),
  addInputRules() {
    return [
      wrappingInputRule({ find: orderedListInputRegex, type: this.type }),
    ];
  },
});

// A list item holds paragraphs and lists, never headings.
const itemContent =
  "paragraph (paragraph | bulletList | orderedList | taskList)*";

// Only the formats notes allow, and links only to web addresses.
export const noteExtensions = [
  Document,
  Paragraph,
  TextNode,
  HardBreak,
  // Deeper headings, as pasted, become the deepest a note has.
  Heading.configure({ levels: [...headingLevels] }).extend({
    parseHTML: () =>
      [1, 2, 3, 4, 5, 6].map((level) => ({
        tag: `h${String(level)}`,
        attrs: { level: Math.min(level, headingLevels.length) },
      })),
  }),
  Bold,
  Italic,
  Strike,
  Code,
  BulletList,
  NoteOrderedList,
  ListItem.extend({ content: itemContent }),
  getTaskListExtension(TaskList),
  TaskItem.configure({ nested: true }).extend({ content: itemContent }),
  ListKeymap,
  UndoRedo,
  NoteColourMark,
  Link.configure({
    openOnClick: false,
    autolink: true,
    protocols: [],
    isAllowedUri: (address) => webAddress(address) !== null,
  }),
];

// What sanitising lets through to the screen: the elements and attributes notes make, and links
// only to web addresses.
export const shownOnly: Options = {
  tagNames: [
    "p",
    "h1",
    "h2",
    "h3",
    "br",
    "strong",
    "em",
    "del",
    "code",
    "a",
    "ul",
    "ol",
    "li",
    "input",
    "span",
  ],
  attributes: {
    a: ["href"],
    span: [["dataColour", ...noteColours]],
    // Checkboxes, which only show whether they are ticked.
    input: [["type", "checkbox"], ["disabled", true], "checked"],
    ul: [["className", "contains-task-list"]],
    li: [["className", "task-list-item"]],
  },
  protocols: { href: ["http", "https"] },
  strip: ["script", "style"],
};

// A link's address as shown: only a web address, as the server keeps them, never a relative one,
// which sanitising alone would let through.
export const shownAddress = (address: string): string =>
  webAddress(address) === address ? address : "";
