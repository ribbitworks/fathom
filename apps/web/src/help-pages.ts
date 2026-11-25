// SPDX-License-Identifier: Apache-2.0

// Help's pages: the Markdown files in docs/help, built into the front end, so Help needs nothing
// from the server and always matches the build it explains. Each is named by its file, such as
// lists for lists.md, and the index, index.md, lists them all. A page's first line is its title.

import type { HelpLink } from "@fathom/shared";

export type HelpPart =
  { kind: "text"; markdown: string } | { kind: "diagram"; drawing: string };

// The page after its title: text in the note format, and diagrams.
export interface HelpPage {
  name: string;
  title: string;
  parts: HelpPart[];
}

export const helpIndex = "index";

const titleLine = /^# (?<title>.+)\n+/u;

const diagramLine = /^!\[[^\]\n]*\]\(diagrams\/([\w-]+\.svg)\)$/mu;

const fileName = (path: string) => path.replace(/^.*\//u, "");

// A page from its file's path and Markdown, with the diagrams' drawings by file name. A drawing
// missing stops the build as it starts, as a missing index does.
export function readHelpPage(
  path: string,
  markdown: string,
  drawings: ReadonlyMap<string, string> = new Map(),
): HelpPage {
  const name = fileName(path).replace(/\.md$/u, "");
  const title = titleLine.exec(markdown)?.groups?.title ?? name;
  // Splitting by a pattern with one group leaves text and drawings' file names in turn.
  const parts = markdown
    .replace(titleLine, "")
    .split(diagramLine)
    .flatMap((piece, at): HelpPart[] => {
      if (at % 2 === 0) {
        return piece.trim() === "" ? [] : [{ kind: "text", markdown: piece }];
      }
      const drawing = drawings.get(piece);
      if (drawing === undefined) {
        throw new Error(`docs/help/diagrams/${piece} is missing.`);
      }
      return [{ kind: "diagram", drawing }];
    });
  return { name, title, parts };
}

// A drawing's own colours are for where it's shown as an image, such as on GitHub.
export const withoutStyle = (drawing: string) =>
  drawing.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gu, "");

// Vitest caches no file it sees calling import.meta.glob, which a type argument would hide.
const files: Record<string, string> = import.meta.glob(
  "../../../docs/help/*.md",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

const drawingFiles: Record<string, string> = import.meta.glob(
  "../../../docs/help/diagrams/*.svg",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

const drawings = new Map(
  Object.entries(drawingFiles).map(([path, drawing]) => [
    fileName(path),
    withoutStyle(drawing),
  ]),
);

const pages = new Map(
  Object.entries(files).map(([path, markdown]) => {
    const page = readHelpPage(path, markdown, drawings);
    return [page.name, page];
  }),
);

export const helpPage = (name: string): HelpPage | undefined => pages.get(name);

export const helpPageNames = (): string[] => [...pages.keys()];

// The page shown at its own address below Help's, which the index never is, since it has Help's.
export const shownHelpPage = (name: string): HelpPage | undefined =>
  name === helpIndex ? undefined : helpPage(name);

// Help's index, without which a build has no Help to open, so it fails as it starts.
export function requiredIndex(found: HelpPage | undefined): HelpPage {
  if (found === undefined) {
    throw new Error("docs/help/index.md is missing, so Help has no index.");
  }
  return found;
}

export const helpIndexPage = requiredIndex(helpPage(helpIndex));

// Where a link to a Help page goes in Fathom: the index at Help's own address, and every other page
// below it, at the heading named, if any.
export function helpDestination({ page, heading }: HelpLink) {
  const hash = heading === undefined ? {} : { hash: heading };
  return page === helpIndex
    ? { to: "/help" as const, ...hash }
    : { to: "/help/$page" as const, params: { page }, ...hash };
}
