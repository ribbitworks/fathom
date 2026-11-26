// SPDX-License-Identifier: Apache-2.0

// Helpers for tests of Help pages: their headings, as Help shows them.

import { markdownWords, parseNote } from "@fathom/shared";
import GithubSlugger from "github-slugger";
import type { HelpPage } from "./help-pages.ts";

// Each heading of a Help page, by its depth, words and anchor. Help draws each text between diagrams
// on its own, so repeated headings' anchors are counted afresh after each diagram.
export function headingsOf(
  page: HelpPage,
): { depth: number; title: string; anchor: string }[] {
  return page.parts.flatMap((part) => {
    if (part.kind !== "text") return [];
    const slugger = new GithubSlugger();
    return parseNote(part.markdown).children.flatMap((node) => {
      if (node.type !== "heading") return [];
      const title = markdownWords(node);
      return [{ depth: node.depth, title, anchor: slugger.slug(title) }];
    });
  });
}
