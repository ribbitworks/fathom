// SPDX-License-Identifier: Apache-2.0

// The button at the end of a record's Name cell that shows its details beside the table, shown
// while the row is pointed at or one of its cells has focus, so they show without the row's menu.
// From the keyboard, the row's menu offers the same.

import { ActionIcon } from "@mantine/core";
import { Icon } from "./icons.tsx";
import classes from "./show-details-button.module.css";

export function ShowDetailsButton({
  name,
  onOpen,
}: {
  name: string;
  onOpen: () => void;
}) {
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="sm"
      tabIndex={-1}
      className={classes.showDetails}
      aria-label={`Show details of ${name}`}
      // The cell would otherwise take the click as choosing or editing it.
      onMouseDown={(event) => {
        event.stopPropagation();
      }}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      <Icon name="open" />
    </ActionIcon>
  );
}
