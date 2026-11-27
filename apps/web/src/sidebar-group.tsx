// SPDX-License-Identifier: Apache-2.0

// A group of the sidebar's items under its heading, and the tip naming an item in the collapsed rail.

import { Stack, Text, Tooltip } from "@mantine/core";
import type { ReactElement, ReactNode } from "react";
import classes from "./layout.module.css";

export const sidebarId = "sections";

// In the rail, each page's name shows beside its icon on hover or focus.
export function RailTip({
  rail,
  label,
  children,
}: {
  rail: boolean;
  label: string;
  children: ReactElement;
}) {
  return (
    <Tooltip
      label={label}
      position="right"
      disabled={!rail}
      events={{ hover: true, focus: true, touch: false }}
      withinPortal
    >
      {children}
    </Tooltip>
  );
}

export function SidebarGroup({
  label,
  rail,
  children,
}: {
  label: string;
  rail: boolean;
  children: ReactNode;
}) {
  const headingId = `${sidebarId}-${label}`;
  return (
    <Stack
      gap={2}
      className={rail ? classes.railSection : undefined}
      role="group"
      aria-labelledby={headingId}
    >
      <Text
        id={headingId}
        className={[classes.section, rail ? classes.railHeading : ""].join(" ")}
      >
        {label}
      </Text>
      {children}
    </Stack>
  );
}
