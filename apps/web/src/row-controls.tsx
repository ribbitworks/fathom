// SPDX-License-Identifier: Apache-2.0

// The controls over a record's Name cell, shown while the row is pointed at or the cell has focus:
// one shows the record's details beside the table, drawn as the panel it opens, and the ⋯ beside it
// opens the row's menu, so neither needs the table scrolled to its end. From the keyboard, the
// row's menu opens with Shift+F10 and offers the same. A planned hire's Fill button sits before
// them. Every other ⋯ that opens a menu, such as a list's or a cycle's, is the same button.

import { ActionIcon, Button } from "@mantine/core";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import { Icon } from "./icons.tsx";
import classes from "./row-controls.module.css";

// A button over a cell, which the cell would otherwise take a click on as choosing or editing it.
// Only the click is kept from it: the press reaches the page, so an open menu closes, as on any
// click outside it.
const overCell = (onSelect: () => void) => ({
  onClick: (event: MouseEvent) => {
    event.stopPropagation();
    onSelect();
  },
});

// The button that opens something in a panel beside, drawn as the panel it opens: a record's details,
// or a note.
export function OpenBesideButton({
  label,
  onOpen,
  ...button
}: {
  label: string;
  onOpen: () => void;
  id?: string;
  className?: string | undefined;
  tabIndex?: number;
}) {
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      size="sm"
      aria-label={label}
      {...button}
      {...overCell(onOpen)}
    >
      <Icon name="sidePanel" />
    </ActionIcon>
  );
}

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
        <OpenBesideButton
          tabIndex={-1}
          label={`Show details of ${details.name}`}
          onOpen={details.onShow}
        />
      )}
      {menu}
    </span>
  );
}

// The keys that open a row's or card's menu from the keyboard.
export const opensMenu = (event: KeyboardEvent): boolean =>
  event.key === "ContextMenu" || (event.key === "F10" && event.shiftKey);

// What a menu of one thing's actions is called.
export const actionsFor = (name: string) => `Actions for ${name}`;

// The ⋯ that opens a menu, such as a record's, its drafts' or the unpublished changes'.
export function MoreButton({
  label,
  ...button
}: {
  label: string;
  size?: "sm";
  id?: string;
  tabIndex?: number;
  disabled?: boolean;
  onClick?: (event: MouseEvent<HTMLButtonElement>) => void;
  "aria-haspopup"?: "menu";
  "aria-expanded"?: boolean;
}) {
  return (
    <ActionIcon
      variant="subtle"
      color="gray"
      aria-label={label}
      // What the menu gives its target, such as opening it on a click.
      {...button}
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
