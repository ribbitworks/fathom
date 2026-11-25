// SPDX-License-Identifier: Apache-2.0

// The heading of a page: its title, with what switches how the page shows its records beside it, the
// Export icon while a table on the page offers its export, and the page's main action. It is one
// height on every page, as tall as a button, unless a narrow window wraps it, with no space of its
// own under it: each page puts the same gap after it, so the row under the heading starts at the
// same place on every page.

import { Group, SegmentedControl, Tabs, Title } from "@mantine/core";
import type { ReactNode } from "react";
import { recordTableClasses } from "./page-styles.ts";
import { PageExportMenu } from "./page-export.tsx";

export function PageHeader({
  title,
  beside,
  action,
}: {
  title: string;
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
  modes,
  mode,
  onMode,
}: {
  label?: string;
  modes: readonly { value: Mode; label: string }[];
  mode: Mode;
  onMode: (mode: Mode) => void;
}) {
  return (
    <SegmentedControl<Mode>
      aria-label={label}
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
      classNames={{
        list: recordTableClasses.headingTabs,
        tab: recordTableClasses.headingTab,
      }}
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
      className={recordTableClasses.tabPanel}
    >
      {children}
    </div>
  );
}
