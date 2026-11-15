// SPDX-License-Identifier: Apache-2.0

// A note's Markdown as the note editor's document, and back, so the editor and the Markdown view
// edit the same note. Markdown is parsed and written by the shared note format, with remark; this
// only maps the Markdown tree's nodes, which notes allow, to the editor's and back. Text is
// coloured by a pair of the palette's colour tags around it, which the editor holds as a mark.

import {
  colourClosing,
  colourOpened,
  colourTag,
  type NoteColour,
  parseNote,
  writeNote,
} from "@fathom/shared";
import type { JSONContent } from "@tiptap/core";
import type {
  BlockContent,
  List,
  ListItem,
  Nodes,
  PhrasingContent,
  RootContent,
} from "mdast";

type Mark = NonNullable<JSONContent["marks"]>[number];

// The marks that wrap others, outermost first, so a run is written with as few marks as can be,
// and a text's marks are always listed in the same order.
const markOrder = ["link", "colour", "bold", "italic", "strike", "code"];

const inOrder = (marks: readonly Mark[]): Mark[] =>
  [...marks].sort(
    (a, b) => markOrder.indexOf(a.type) - markOrder.indexOf(b.type),
  );

// The editor's inline content for a run of a Markdown paragraph's, with the marks around it and
// the colours opened around it, of which the innermost shows, since text has one colour.
function inline(
  nodes: readonly Nodes[],
  marks: readonly Mark[],
  opened: readonly Mark[],
): JSONContent[] {
  const content: JSONContent[] = [];
  let colours = opened;
  for (const node of nodes) {
    const shown = inOrder([...marks, ...colours.slice(-1)]);
    const within = (mark: Mark, children: readonly Nodes[]) =>
      content.push(...inline(children, [...marks, mark], colours));
    // Markdown has node types inline text never holds, and those are left out.
    // eslint-disable-next-line @typescript-eslint/switch-exhaustiveness-check
    switch (node.type) {
      case "text":
        content.push({
          type: "text",
          text: node.value,
          ...(shown.length > 0 ? { marks: shown } : {}),
        });
        break;
      case "inlineCode":
        content.push({
          type: "text",
          text: node.value,
          marks: inOrder([...shown, { type: "code" }]),
        });
        break;
      case "break":
        content.push({ type: "hardBreak" });
        break;
      case "strong":
        within({ type: "bold" }, node.children);
        break;
      case "emphasis":
        within({ type: "italic" }, node.children);
        break;
      case "delete":
        within({ type: "strike" }, node.children);
        break;
      case "link":
        within({ type: "link", attrs: { href: node.url } }, node.children);
        break;
      case "html": {
        // A kept note's tags are the palette's, each opening matched by a closing.
        const colour = colourOpened(node.value);
        colours =
          colour === undefined
            ? colours.slice(0, -1)
            : [...colours, { type: "colour", attrs: { colour } }];
        break;
      }
    }
  }
  return content;
}

function blocks(nodes: readonly (RootContent | BlockContent)[]): JSONContent[] {
  return nodes.flatMap((node): JSONContent[] => {
    if (node.type === "paragraph" || node.type === "heading") {
      const content = inline(node.children, [], []);
      return [
        {
          type: node.type,
          ...(node.type === "heading" ? { attrs: { level: node.depth } } : {}),
          ...(content.length > 0 ? { content } : {}),
        },
      ];
    }
    // A kept note holds only paragraphs, headings, and lists, whose items all have checkboxes or
    // none, and numbered lists, which have none.
    const list = node as List;
    const tasks = list.children.some(
      (item) => typeof item.checked === "boolean",
    );
    return [
      {
        type: tasks
          ? "taskList"
          : list.ordered === true
            ? "orderedList"
            : "bulletList",
        content: list.children.map((item) => ({
          type: tasks ? "taskItem" : "listItem",
          ...(tasks ? { attrs: { checked: item.checked === true } } : {}),
          // An item always starts with a paragraph in the editor, if only an empty one.
          content:
            item.children.length === 0
              ? [{ type: "paragraph" }]
              : blocks(item.children),
        })),
      },
    ];
  });
}

// A kept note as the editor's document.
export function noteToDoc(markdown: string): JSONContent {
  const content = blocks(parseNote(markdown).children);
  return {
    type: "doc",
    content: content.length > 0 ? content : [{ type: "paragraph" }],
  };
}

type Run = { text: string; marks: Mark[] } | { break: true; marks: Mark[] };

const sameMark = (first: Mark | undefined, second: Mark | undefined) =>
  first?.type === second?.type &&
  JSON.stringify(first?.attrs ?? {}) === JSON.stringify(second?.attrs ?? {});

const markOf = (run: Run, type: string) =>
  run.marks.find((mark) => mark.type === type);

// Runs of text written as Markdown, wrapped in the marks from the order given, outermost first.
function phrasing(
  runs: readonly Run[],
  order: readonly string[],
): PhrasingContent[] {
  const [type, ...rest] = order;
  if (type === undefined) {
    return runs.map((run): PhrasingContent => {
      if ("break" in run) return { type: "break" };
      return markOf(run, "code") === undefined
        ? { type: "text", value: run.text }
        : { type: "inlineCode", value: run.text };
    });
  }
  // Runs next to each other that share the mark, or both lack it, are written together.
  const groups: { mark: Mark | undefined; runs: Run[] }[] = [];
  for (const run of runs) {
    const mark = markOf(run, type);
    const last = groups.at(-1);
    if (last !== undefined && sameMark(last.mark, mark)) last.runs.push(run);
    else groups.push({ mark, runs: [run] });
  }
  const written: PhrasingContent[] = [];
  for (const { mark, runs: group } of groups) {
    const inner = phrasing(group, rest);
    if (mark === undefined) written.push(...inner);
    else if (type === "link") {
      written.push({
        type: "link",
        url: String(mark.attrs?.href),
        title: null,
        children: inner,
      });
    } else if (type === "colour") {
      written.push(
        { type: "html", value: colourTag(mark.attrs?.colour as NoteColour) },
        ...inner,
        { type: "html", value: colourClosing },
      );
    } else {
      written.push({
        type:
          type === "bold"
            ? "strong"
            : type === "italic"
              ? "emphasis"
              : "delete",
        children: inner,
      });
    }
  }
  return written;
}

// Marks that may begin or end on a space; Markdown cannot write the others that way, but for
// character references, so spaces at their ends are moved outside them.
const spaceMarks = new Set(["link", "colour"]);

// A text's runs, with spaces at the ends of bold, italic or struck through text outside it. Code
// keeps its spaces.
function textRuns(text: string, marks: Mark[]): Run[] {
  // Every text matches, if only with empty groups.
  const [, before, middle, after] = /^(\s*)(.*?)(\s*)$/su.exec(
    text,
  ) as unknown as [string, string, string, string];
  if (marks.some((mark) => mark.type === "code")) return [{ text, marks }];
  const spaced = marks.filter((mark) => spaceMarks.has(mark.type));
  if (middle === "") return [{ text, marks: spaced }];
  return [
    ...(before === "" ? [] : [{ text: before, marks: spaced }]),
    { text: middle, marks },
    ...(after === "" ? [] : [{ text: after, marks: spaced }]),
  ];
}

// The editor's text nodes always hold text, and its line breaks no marks. Line breaks at either end
// of a block go, since Markdown cannot end one with a break; a heading's breaks are spaces, since a
// heading is one line.
function runsOf(content: readonly JSONContent[] = [], heading = false): Run[] {
  const runs = content.flatMap((node): Run[] => {
    if (node.type !== "hardBreak") {
      return textRuns(node.text as string, node.marks ?? []);
    }
    return heading ? [{ text: " ", marks: [] }] : [{ break: true, marks: [] }];
  });
  const first = runs.findIndex((run) => !("break" in run));
  const last = runs.findLastIndex((run) => !("break" in run));
  return runs.slice(first, last + 1);
}

function toBlocks(
  content: readonly JSONContent[] = [],
): (RootContent & BlockContent)[] {
  return content.flatMap((node): (RootContent & BlockContent)[] => {
    const children = () =>
      phrasing(
        runsOf(node.content, node.type === "heading"),
        markOrder.slice(0, -1),
      );
    if (node.type === "paragraph")
      return [{ type: "paragraph", children: children() }];
    if (node.type === "heading") {
      return [
        {
          type: "heading",
          depth: node.attrs?.level as 1 | 2 | 3,
          children: children(),
        },
      ];
    }
    const tasks = node.type === "taskList";
    const ordered = node.type === "orderedList";
    // An empty item goes, since Markdown could not keep its checkbox.
    const items = (node.content as JSONContent[]).flatMap(
      (item): ListItem[] => {
        const children = toBlocks(item.content);
        return children.every(
          (block) => block.type === "paragraph" && block.children.length === 0,
        )
          ? []
          : [
              {
                type: "listItem",
                spread: false,
                checked: tasks ? item.attrs?.checked === true : null,
                children,
              },
            ];
      },
    );
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
  });
}

// The editor's document as a note's Markdown, written as every note is.
export const docToNote = (doc: JSONContent): string =>
  writeNote({ type: "root", children: toBlocks(doc.content) });
