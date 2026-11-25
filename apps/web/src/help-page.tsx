// SPDX-License-Identifier: Apache-2.0

// A Help page: its text as a note reads, through the one rendering notes use, with headings as
// anchors for links between Help pages, and its diagrams in Fathom's colours. Its title heads it.

import { Paper, Stack } from "@mantine/core";
import classes from "./help-page.module.css";
import type { HelpPage } from "./help-pages.ts";
import { NoteView } from "./note-editor.tsx";
import { PageHeader } from "./page-header.tsx";
import pages from "./pages.module.css";

export function HelpPageView({ page }: { page: HelpPage }) {
  return (
    <Stack gap="md">
      <PageHeader title={page.title} />
      <Paper withBorder p="lg">
        <Stack gap="md">
          {page.parts.map((part, at) =>
            part.kind === "text" ? (
              <NoteView key={at} note={part.markdown} anchors />
            ) : (
              <div
                key={at}
                className={[classes.diagram, pages.scrollBars].join(" ")}
                // A diagram wider than the window scrolls, so the keyboard can reach it too.
                tabIndex={0}
                // Drawings are built in from the repository, as the pages are, never from a user.
                dangerouslySetInnerHTML={{ __html: part.drawing }}
              />
            ),
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
