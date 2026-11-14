// SPDX-License-Identifier: Apache-2.0

// The controls over a record's Name cell, shown while the row is pointed at or the cell has focus:
// one shows the record's details beside the table, drawn as the panel it opens, and the ⋯ beside it
// opens the row's menu, so neither needs the table scrolled to its end. From the keyboard, the
// row's menu opens with Shift+F10 and offers the same. A planned hire's Fill button sits before
// them.

import { ActionIcon, Button } from "@mantine/core";
import type { MouseEvent, ReactNode } from "react";
import { Icon } from "./icons.tsx";
import classes from "./row-controls.module.css";

const keptFromCell = {
  onMouseDown: (event: MouseEvent) => {
    event.stopPropagation();
  },
};

const overCell = (onSelect: () => void) => ({
  ...keptFromCell,
  onClick: (event: MouseEvent) => {
    event.stopPropagation();
    onSelect();
  },
});

export function RowControls({
  details,
  menu,
}: {
  // The record named, and showing its details, for a record that has them.
  details?: { name: string; onShow: () => void } | undefined;
  // The row's menu, opened from its ⋯.
  menu?: ReactNode;
}) {
  return (
    <span className={classes.rowControls}>
      {details !== undefined && (
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          tabIndex={-1}
          aria-label={`Show details of ${details.name}`}
          {...overCell(details.onShow)}
        >
          <Icon name="sidePanel" />
        </ActionIcon>
      )}
      {menu}
    </span>
  );
}

// What a record's menu is called, wherever its ⋯ is.
export const actionsFor = (name: string) => `Actions for ${name}`;

// The ⋯ that opens a menu, such as a record's, its drafts' or the unpublished changes'.
export function MoreButton({
  label,
  inCell = false,
  ...button
}: {
  label: string;
  inCell?: boolean;
  size?: "sm";
  id?: string;
  tabIndex?: number;
  disabled?: boolean;
}) {
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      aria-label={label}
      // What the menu gives its target, such as opening it on a click.
      {...button}
      {...(inCell ? keptFromCell : {})}
    >
      <Icon name="more" />
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
