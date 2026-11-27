// SPDX-License-Identifier: Apache-2.0

// The heading of a page: its title, what switches how it shows its records, the Export icon and
// its main action.

import { Group, SegmentedControl, Tabs, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { PageExportMenu } from "./page-export.tsx";
import classes from "./pages.module.css";

export function PageHeader({
  title,
  mark,
  beside,
  action,
}: {
  title: string;
  // Before the title, such as a private page's ring.
  mark?: ReactNode;
  beside?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <Group
      justify="space-between"
      align="center"
      gap="md"
      mih="var(--fathom-heading-height)"
    >
      <Group gap="lg" align="center">
        <Title order={1} fz={22}>
          {mark}
          {title}
        </Title>
        {beside}
      </Group>
      <Group gap="xs">
        <PageExportMenu />
        {action}
      </Group>
    </Group>
  );
}

// The switch between the ways a page shows its records, such as Table and Board, for the heading's
// beside.
export function ModeSwitch<Mode extends string>({
  label = "What the page shows",
  name,
  modes,
  mode,
  onMode,
}: {
  label?: string;
  // Names each option's radio button after its own name, for a page that puts focus on one.
  name?: string;
  modes: readonly { value: Mode; label: string }[];
  mode: Mode;
  onMode: (mode: Mode) => void;
}) {
  return (
    <SegmentedControl<Mode>
      aria-label={label}
      {...(name === undefined ? {} : { name })}
      value={mode}
      onChange={onMode}
      data={[...modes]}
    />
  );
}

// A page's tabs, beside its title, such as Projects' tables. Arrow keys move between them.
export function HeadingTabs<Tab extends string>({
  id,
  label,
  tabs,
  tab,
  onTab,
}: {
  id: string;
  label: string;
  tabs: readonly { value: Tab; label: ReactNode }[];
  tab: Tab;
  onTab: (tab: Tab) => void;
}) {
  return (
    <Tabs
      id={id}
      value={tab}
      classNames={{ list: classes.headingTabs, tab: classes.headingTab }}
      onChange={(next) => {
        // A tab can't be cleared, so one always matches; the filter types it with no check.
        for (const one of tabs.filter(({ value }) => value === next)) {
          onTab(one.value);
        }
      }}
    >
      <Tabs.List aria-label={label}>
        {tabs.map((one) => (
          <Tabs.Tab
            key={one.value}
            value={one.value}
            // Only the chosen tab's content is drawn, so only it has a panel to point at.
            aria-controls={
              one.value === tab ? tabPanelId(id, one.value) : undefined
            }
          >
            {one.label}
          </Tabs.Tab>
        ))}
      </Tabs.List>
    </Tabs>
  );
}

const tabPanelId = (id: string, tab: string) => `${id}-panel-${tab}`;

// The chosen tab's content, named by its tab, whose id Mantine makes from the tabs' id.
export function HeadingTabPanel({
  id,
  tab,
  children,
}: {
  id: string;
  tab: string;
  children: ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={tabPanelId(id, tab)}
      aria-labelledby={`${id}-tab-${tab}`}
      className={classes.tabPanel}
    >
      {children}
    </div>
  );
}
