// SPDX-License-Identifier: Apache-2.0

// A note as a panel shows it among other things: folded by Mantine's Spoiler to about a dozen lines,
// fading out, with Show more under it. Where the note has a panel of its own, Show more opens it
// there; elsewhere it shows the note in full in place, with Show less to fold it again. A note that
// fits shows in full, with no link.

import { Spoiler } from "@mantine/core";
import { useState } from "react";
import classes from "./folded-note.module.css";
import { NoteView } from "./note-editor.tsx";

// About a dozen lines of a note's text, in pixels at the default text size, as Spoiler takes it.
const foldHeight = 256;

export function FoldedNote({
  name,
  note,
  onOpen,
}: {
  // What the note is, such as its column's name, which its Show more is named for.
  name: string;
  note: string;
  onOpen?: (() => void) | undefined;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Spoiler
      maxHeight={foldHeight}
      showLabel="Show more"
      hideLabel="Show less"
      showAriaLabel={`Show more of ${name}`}
      hideAriaLabel={`Show less of ${name}`}
      expanded={open}
      onExpandedChange={(expanded) => {
        if (onOpen === undefined) setOpen(expanded);
        else onOpen();
      }}
      classNames={{ root: classes.root, content: classes.content }}
      data-open={open || undefined}
    >
      <NoteView note={note} />
    </Spoiler>
  );
}
