// SPDX-License-Identifier: Apache-2.0

// The Capacity page, in modes kept in the address: People, the allocations grid, and Settings, the
// planning settings that capacity and forecasts are worked out with. A switch picks the mode for a
// role that sees both; a role that sees one sees it alone.

import type { CapacityMode, DraftKind } from "@fathom/shared";
import { Stack } from "@mantine/core";
import { useState } from "react";
import { CapacityPeople } from "./capacity-people.tsx";
import { ModeSwitch, PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { PlanningSettingsTab } from "./planning-settings-tab.tsx";
import type { MonthGridProps } from "./month-grid.tsx";
import { today } from "./today.ts";

const modeLabels: Record<CapacityMode, string> = {
  people: "People",
  settings: "Settings",
};

export function CapacityPage({
  modes,
  mode,
  onMode,
  canEditSettings,
  approves,
  ...grid
}: Omit<MonthGridProps, "now"> & {
  // The modes the role sees, in order.
  modes: readonly CapacityMode[];
  mode: CapacityMode;
  onMode: (mode: CapacityMode) => void;
  canEditSettings: boolean;
  // The kinds of draft the user may approve and reject.
  approves: readonly DraftKind[];
}) {
  const [now] = useState(today);
  return (
    <Stack
      gap="md"
      className={mode === "people" ? classes.tablePage : undefined}
    >
      <PageHeader
        title="Capacity"
        beside={
          modes.length > 1 && (
            <ModeSwitch
              modes={modes.map((one) => ({
                value: one,
                // The mode is always one of the typed modes, each a key of the labels.
                // eslint-disable-next-line security/detect-object-injection
                label: modeLabels[one],
              }))}
              mode={mode}
              onMode={onMode}
            />
          )
        }
      />
      {mode === "settings" ? (
        <PlanningSettingsTab
          canEdit={canEditSettings}
          approves={approves}
          show={grid.view.show}
          onShow={(show) => {
            grid.onView({ ...grid.view, show }, true);
          }}
        />
      ) : (
        <CapacityPeople now={now} {...grid} />
      )}
    </Stack>
  );
}
