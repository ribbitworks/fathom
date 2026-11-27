// SPDX-License-Identifier: Apache-2.0

// The Capacity page: its tabs, Feature teams and Allocations, the tab shown, and a link to the
// planning settings.

import type { CapacityMode } from "@fathom/shared";
import { Anchor, Stack } from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { CapacityAllocations } from "./capacity-allocations.tsx";
import { CapacityFeatureTeams } from "./capacity-feature-teams.tsx";
import type { MonthGridProps } from "./month-grid.tsx";
import { HeadingTabPanel, HeadingTabs, PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { today } from "./today.ts";

const tabLabels: Record<CapacityMode, string> = {
  "feature-teams": "Feature teams",
  allocations: "Allocations",
};

const tabsId = "capacity-tabs";

export function CapacityPage({
  modes,
  mode,
  onMode,
  seesHires,
  editsTeams,
  changesDates,
  opensSettings,
  ...grid
}: Omit<MonthGridProps, "now"> & {
  // The tabs the role sees, in order.
  modes: readonly CapacityMode[];
  mode: CapacityMode;
  onMode: (mode: CapacityMode) => void;
  // Whether the reader sees planned hires, each a row with no teams on Feature teams.
  seesHires: boolean;
  editsTeams: boolean;
  // Whether the reader may change Personal details, and so months before the current one.
  changesDates: boolean;
  opensSettings: boolean;
}) {
  const [now] = useState(today);
  const tabs: Record<CapacityMode, () => ReactNode> = {
    "feature-teams": () => (
      <CapacityFeatureTeams
        seesHires={seesHires}
        editsTeams={editsTeams}
        changesDates={changesDates}
        now={now}
        {...grid}
      />
    ),
    allocations: () => <CapacityAllocations now={now} {...grid} />,
  };
  // The tab is always one of the fixed tabs.
  // eslint-disable-next-line security/detect-object-injection
  const content = tabs[mode]();
  const tabbed = modes.length > 1;
  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader
        title="Capacity"
        action={
          opensSettings && (
            <Anchor
              size="sm"
              renderRoot={(props) => (
                <Link {...props} to="/planning-settings" />
              )}
            >
              Planning settings
            </Anchor>
          )
        }
        beside={
          tabbed && (
            <HeadingTabs
              id={tabsId}
              label="Capacity tabs"
              tabs={modes.map((one) => ({
                value: one,
                // The tab is always one of the fixed tabs, each a key of the labels.
                // eslint-disable-next-line security/detect-object-injection
                label: tabLabels[one],
              }))}
              tab={mode}
              onTab={onMode}
            />
          )
        }
      />
      {tabbed ? (
        <HeadingTabPanel key={mode} id={tabsId} tab={mode}>
          {content}
        </HeadingTabPanel>
      ) : (
        content
      )}
    </Stack>
  );
}
