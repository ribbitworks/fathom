// SPDX-License-Identifier: Apache-2.0

// Notes: rich text kept as Markdown, parsed, checked and written the same way in the server and the
// browser.

import type {
  Html,
  List,
  ListItem,
  Nodes,
  Parent,
  PhrasingContent,
  Root,
  RootContent,
} from "mdast";
import remarkGfm from "remark-gfm";
import remarkParse from "remark-parse";
import remarkStringify from "remark-stringify";
import { unified } from "unified";
import { noteAddress, shownLinkText } from "./links.ts";
import { paletteColours } from "./palette.ts";

export const noteLength = 10_000;

// The fields of the plan's records that hold a note, by kind of record, which drafts and the change
// history show as the note's words without their formatting.
const noteFields = new Map<string, readonly string[]>([
  ["release", ["note"]],
  ["feature", ["note"]],
  ["customer", ["note"]],
]);

export const isNoteField = (recordType: string, field: string): boolean =>
  noteFields.get(recordType)?.includes(field) === true;

export const headingLevels = [1, 2, 3] as const;

const deepestHeading = headingLevels.length;

// A note's colours are the palette releases and teams share, readable in light and dark mode alike.
export const noteColours = paletteColours;

export type NoteColour = (typeof noteColours)[number];

export const isNoteColour = (value: unknown): value is NoteColour =>
  noteColours.some((colour) => colour === value);

const colourOpening = /^<span data-colour="([a-z]+)">$/u;
export const colourClosing = "</span>";

export const colourTag = (colour: NoteColour): string =>
  `<span data-colour="${colour}">`;

// The colour an inline HTML tag opens, or undefined when it opens none of the palette's.
export function colourOpened(tag: string): NoteColour | undefined {
  const colour = colourOpening.exec(tag)?.[1];
  return isNoteColour(colour) ? colour : undefined;
}

const parser = unified().use(remarkParse).use(remarkGfm);

const writer = unified().use(remarkGfm).use(remarkStringify, {
  bullet: "-",
  emphasis: "_",
  strong: "*",
  listItemIndent: "one",
});

export const parseNote = (markdown: string): Root => parser.parse(markdown);

export const writeNote = (tree: Root): string =>
  writer.stringify(tree).trimEnd();

const phrasingTypes = new Set([
  "text",
  "strong",
  "emphasis",
  "delete",
  "inlineCode",
  "link",
  "break",
  "html",
]);

const hasChildren = (node: Nodes): node is Nodes & Parent => "children" in node;

// Every node the parser gives that a note may not hold is named below.
const cannotHold = (node: Nodes) =>
  `A note can't hold ${nodeNames[node.type] as string}.`;

// Why a run of inline content's HTML is not balanced pairs of the palette's colour tags, if it is
// not.
function colourTagsProblem(children: readonly Nodes[]): string | undefined {
  let open = 0;
  for (const child of children) {
    if (child.type !== "html") continue;
    if (child.value === colourClosing) open -= 1;
    else if (colourOpened(child.value) !== undefined) open += 1;
    else return "A note can only colour text from its palette.";
    if (open < 0) return "A note's colours must open before they close.";
  }
  return open === 0 ? undefined : "A note's colours must close.";
}

// Why inline content is not allowed in a note, if it is not.
function inlineProblem(children: readonly Nodes[]): string | undefined {
  const tags = colourTagsProblem(children);
  if (tags !== undefined) return tags;
  for (const node of children) {
    if (!phrasingTypes.has(node.type)) return cannotHold(node);
    if (
      node.type === "link" &&
      (noteAddress(node.url) !== node.url ||
        (node.title !== null && node.title !== undefined))
    ) {
      return "A note's links must be web addresses, starting with http or https, or Help pages, such as lists.md.";
    }
    const problem = hasChildren(node)
      ? inlineProblem(node.children)
      : undefined;
    if (problem !== undefined) return problem;
  }
  return undefined;
}

const hasCheckbox = (item: ListItem) =>
  item.checked !== null && item.checked !== undefined;

// Why a list is not allowed in a note, if it is not: bullets or numbers from 1, every bullet item
// with a checkbox or none, and items holding paragraphs and lists.
function listProblem(list: List): string | undefined {
  const checkboxes = list.children.filter(hasCheckbox).length;
  if (list.ordered === true && checkboxes !== 0) {
    return "A numbered list's items can't have checkboxes.";
  }
  if (list.ordered === true && list.start !== 1) {
    return "A note's numbered lists start at 1.";
  }
  if (checkboxes !== 0 && checkboxes !== list.children.length) {
    return "A list's items must all have checkboxes, or none.";
  }
  for (const item of list.children) {
    const problem = blockProblem(item.children, false);
    if (problem !== undefined) return problem;
  }
  return undefined;
}

// Why block content is not allowed in a note, if it is not: paragraphs, lists, and, outside lists,
// headings three levels deep.
function blockProblem(
  children: readonly Nodes[],
  headings: boolean,
): string | undefined {
  for (const node of children) {
    let problem: string | undefined;
    if (node.type === "paragraph") problem = inlineProblem(node.children);
    else if (node.type === "list") problem = listProblem(node);
    else if (node.type !== "heading") problem = cannotHold(node);
    else if (!headings) problem = "A note's lists can't hold headings.";
    else if (node.depth > deepestHeading) {
      problem = "A note's headings go three levels deep at most.";
    } else problem = inlineProblem(node.children);
    if (problem !== undefined) return problem;
  }
  return undefined;
}

// What people call what a note cannot hold, by its type in the Markdown tree.
const nodeNames: Readonly<Record<string, string>> = {
  blockquote: "quotes",
  code: "code blocks",
  table: "tables",
  image: "images",
  imageReference: "images",
  thematicBreak: "lines across",
  html: "HTML",
  linkReference: "reference links",
  definition: "reference links",
  footnoteReference: "footnotes",
  footnoteDefinition: "footnotes",
};

// Why Markdown holds something outside what notes allow, whatever its length, or undefined when
// it holds nothing else.
export const noteFormatProblem = (markdown: string): string | undefined =>
  blockProblem(parseNote(markdown).children, true);

// Why a note cannot be kept as it is, or undefined when it can: too long, or holding something
// outside what notes allow.
export function noteProblem(markdown: string): string | undefined {
  if (markdown.length > noteLength) {
    return `A note can be at most ${noteLength.toLocaleString("en")} characters.`;
  }
  return noteFormatProblem(markdown);
}

const text = (value: string): PhrasingContent => ({ type: "text", value });

// The palette's colour tags in a run of inline content, each opening matched by a closing, with
// any other tag, or one left unmatched, removed.
function balancedColours(children: PhrasingContent[]): PhrasingContent[] {
  const kept: PhrasingContent[] = [];
  const opened: number[] = [];
  for (const child of children) {
    if (child.type !== "html") {
      kept.push(child);
    } else if (colourOpened(child.value) !== undefined) {
      opened.push(kept.length);
      kept.push(child);
    } else if (child.value === colourClosing && opened.length > 0) {
      opened.pop();
      kept.push(child);
    }
  }
  const unmatched = new Set(opened);
  return kept.filter((_, at) => !unmatched.has(at));
}

// Inline content as a note allows it: links only to web addresses and Help pages, without titles,
// and only the palette's colour tags; anything else becomes its text, or goes.
function cleanInline(nodes: readonly Nodes[]): PhrasingContent[] {
  const cleaned = nodes.flatMap((node): PhrasingContent[] => {
    switch (node.type) {
      case "text":
      case "inlineCode":
      case "break":
        return [node];
      case "strong":
      case "emphasis":
      case "delete":
        return [{ ...node, children: cleanInline(node.children) }];
      case "link": {
        const url = noteAddress(node.url);
        const children = cleanInline(node.children);
        return url === null
          ? children
          : [{ type: "link", url, title: null, children }];
      }
      case "html":
        return [node satisfies Html];
      case "image":
      case "imageReference":
        return node.alt ? [text(node.alt)] : [];
      default:
        // Reference links keep their text; footnote references hold none.
        return hasChildren(node) ? cleanInline(node.children) : [];
    }
  });
  return balancedColours(cleaned);
}

const paragraph = (children: PhrasingContent[]): RootContent[] =>
  children.length === 0 ? [] : [{ type: "paragraph", children }];

// Block content as a note allows it: paragraphs, lists, and, outside lists, headings three levels
// deep, with deeper headings made the deepest, and quotes, code blocks, tables, and the like kept
// only as their text.
function cleanBlocks(
  nodes: readonly Nodes[],
  headings: boolean,
): RootContent[] {
  return nodes.flatMap((node): RootContent[] => {
    switch (node.type) {
      case "paragraph":
        return paragraph(cleanInline(node.children));
      case "heading": {
        const children = cleanInline(node.children);
        if (!headings) return paragraph(children);
        const depth = Math.min(node.depth, deepestHeading) as 1 | 2 | 3;
        return children.length === 0
          ? []
          : [{ type: "heading", depth, children }];
      }
      case "list": {
        // A list with any checkbox gives every item one, unticked where it had none, and has
        // bullets, since checkboxes are never numbered. A numbered list starts at 1.
        const checkboxes = node.children.some(hasCheckbox);
        const ordered = node.ordered === true && !checkboxes;
        const items = node.children.flatMap((item): ListItem[] => {
          // Cleaning keeps only paragraphs and lists inside lists, which a list item may hold.
          const children = cleanBlocks(
            item.children,
            false,
          ) as ListItem["children"];
          // An empty item, which could not keep its checkbox, goes.
          return children.length === 0
            ? []
            : [
                {
                  type: "listItem",
                  spread: false,
                  checked: checkboxes ? item.checked === true : null,
                  children,
                },
              ];
        });
        return items.length === 0
          ? []
          : [
              {
                type: "list",
                ordered,
                ...(ordered ? { start: 1 } : {}),
                spread: false,
                children: items,
              },
            ];
      }
      case "code":
        return paragraph([text(node.value)]);
      case "table":
        return node.children.flatMap((row) =>
          paragraph(
            row.children.flatMap((cell, at) => [
              ...(at === 0 ? [] : [text(" ")]),
              ...cleanInline(cell.children),
            ]),
          ),
        );
      case "blockquote":
        return cleanBlocks(node.children, headings);
      default:
        // HTML blocks, lines across, reference definitions, and footnotes go.
        return [];
    }
  });
}

// A note as typed or pasted, cleaned to what notes allow and written as Fathom writes every note,
// so it passes noteProblem unless it is too long.
export const cleanNote = (markdown: string): string =>
  writeNote({
    type: "root",
    children: cleanBlocks(parseNote(markdown).children, true),
  });

// A note with one checkbox ticked or unticked: the one at the given place, counting from the first
// in the note, as they read from the top.
export function toggleCheckbox(markdown: string, at: number): string {
  const tree = parseNote(markdown);
  const boxes: ListItem[] = [];
  const visit = (node: Nodes) => {
    if (node.type === "listItem" && typeof node.checked === "boolean") {
      boxes.push(node);
    }
    if (hasChildren(node)) node.children.forEach(visit);
  };
  visit(tree);
  const box = at < 0 ? undefined : boxes.at(at);
  if (box === undefined) return markdown;
  box.checked = !box.checked;
  return writeNote(tree);
}

// Notes' words, by their Markdown and whether links show only their hosts, so a table that sorts or
// searches by them parses each note once.
const plainTexts = new Map<string, string>();
const plainTextsKept = 2_000;

// A piece of a note's words without their formatting, colour tags left out and a line break as a
// space. A link shows its text, or, with hosts, its host where its text only repeats its address.
export function markdownWords(node: Nodes, hosts = false): string {
  if (node.type === "html") return "";
  if ("value" in node) return node.value;
  if (node.type === "link" && hosts) {
    return shownLinkText(
      node.url,
      node.children.map((child) => markdownWords(child, hosts)).join(""),
    );
  }
  return hasChildren(node)
    ? node.children.map((child) => markdownWords(child, hosts)).join("")
    : " ";
}

// A note's words without their formatting, each paragraph, heading, and list item on its own line.
// Links show their text, so search and the change history find every word of an address written
// out; a short preview shows a link whose text only repeats its address as its host instead.
export function notePlainText(markdown: string, hosts = false): string {
  const cacheKey = `${String(hosts)}:${markdown}`;
  const known = plainTexts.get(cacheKey);
  if (known !== undefined) return known;
  const lines: string[] = [];
  const words = (node: Nodes) => markdownWords(node, hosts);
  // Above paragraphs and headings are only the root, lists, and list items.
  const visit = (node: Nodes) => {
    if (node.type === "paragraph" || node.type === "heading") {
      lines.push(words(node));
    } else (node as Parent).children.forEach(visit);
  };
  visit(parseNote(markdown));
  const plain = lines.filter((line) => line.trim() !== "").join("\n");
  // The oldest goes first once the cache is full.
  if (plainTexts.size >= plainTextsKept) {
    plainTexts.delete(plainTexts.keys().next().value as string);
  }
  plainTexts.set(cacheKey, plain);
  return plain;
}
