// SPDX-License-Identifier: Apache-2.0

// Help's pages: the Markdown files in docs/help, built into the front end, so Help needs nothing
// from the server and always matches the build it explains. Each is named by its file, such as
// lists for lists.md, and the index, index.md, lists them all. A page's first line is its title.

import type { HelpLink } from "@fathom/shared";

export interface HelpPage {
  name: string;
  title: string;
  // The page after its title, in the note format.
  body: string;
}

export const helpIndex = "index";

const titleLine = /^# (?<title>.+)\n+/u;

// A page from its file's path and Markdown.
export function readHelpPage(path: string, markdown: string): HelpPage {
  const name = path.replace(/^.*\//u, "").replace(/\.md$/u, "");
  const title = titleLine.exec(markdown)?.groups?.title ?? name;
  return { name, title, body: markdown.replace(titleLine, "") };
}

// Vitest caches no file it sees calling import.meta.glob, which a type argument would hide.
const files: Record<string, string> = import.meta.glob(
  "../../../docs/help/*.md",
  {
    query: "?raw",
    import: "default",
    eager: true,
  },
);

const pages = new Map(
  Object.entries(files).map(([path, markdown]) => {
    const page = readHelpPage(path, markdown);
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
