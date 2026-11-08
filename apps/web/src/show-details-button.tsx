// SPDX-License-Identifier: Apache-2.0

// The buttons over a record's Name cell. One shows the record's details beside the table, shown while
// the row is pointed at or one of its cells has focus, so they show without the row's menu; from the
// keyboard, the row's menu offers the same. The other starts filling a planned hire.

import { ActionIcon, Button } from "@mantine/core";
import type { MouseEvent } from "react";
import { Icon } from "./icons.tsx";
import classes from "./show-details-button.module.css";

// A button over a cell, which the cell would otherwise take a click on as choosing or editing it.
const overCell = (onSelect: () => void) => ({
  onMouseDown: (event: MouseEvent) => {
    event.stopPropagation();
  },
  onClick: (event: MouseEvent) => {
    event.stopPropagation();
    onSelect();
  },
});

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
      {...overCell(onOpen)}
    >
      <Icon name="open" />
    </ActionIcon>
  );
}

export function FillHireButton({
  name,
  onFill,
}: {
  name: string;
  onFill: () => void;
}) {
  return (
    <Button
      variant="default"
      size="compact-xs"
      tabIndex={-1}
      className={classes.fillHire}
      aria-label={`Fill ${name}`}
      {...overCell(onFill)}
    >
      Fill
    </Button>
  );
}
