// SPDX-License-Identifier: Apache-2.0

// A Help page, as a note reads, through the one rendering notes use, with its headings as anchors
// that links between Help pages can lead to. Its title is the page's heading.

import { Paper, Stack } from "@mantine/core";
import type { HelpPage } from "./help-pages.ts";
import { NoteView } from "./note-editor.tsx";
import { PageHeader } from "./page-header.tsx";

export function HelpPageView({ page }: { page: HelpPage }) {
  return (
    <Stack gap="md">
      <PageHeader title={page.title} />
      <Paper withBorder p="lg">
        <NoteView note={page.body} anchors />
      </Paper>
    </Stack>
  );
}
