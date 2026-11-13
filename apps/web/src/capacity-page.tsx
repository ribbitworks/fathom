// SPDX-License-Identifier: Apache-2.0

// The Capacity page, in modes kept in the address: People, the allocations grid, and Settings, the
// planning settings that capacity and forecasts are worked out with. A switch picks the mode for a
// role that sees both; a role that sees one sees it alone.

import { Group, SegmentedControl, Stack } from "@mantine/core";
import { useState } from "react";
import { type CapacityMode, capacityModeSchema } from "./capacity.ts";
import { CapacityPeople } from "./capacity-people.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { PlanningSettingsTab } from "./planning-settings-tab.tsx";
import type { View } from "./table-view.ts";
import { today } from "./today.ts";

const modeLabels: Record<CapacityMode, string> = {
  people: "People",
  settings: "Settings",
};

export function CapacityPage({
  modes,
  mode,
  onMode,
  byManager,
  view,
  onView,
  canEditSettings,
}: {
  // The modes the role sees, in order.
  modes: readonly CapacityMode[];
  mode: CapacityMode;
  onMode: (mode: CapacityMode) => void;
  // Whether the reader may group People's rows by manager, which shows later months' managers.
  byManager: boolean;
  view: View;
  onView: (view: View, replace?: boolean) => void;
  canEditSettings: boolean;
}) {
  const [now] = useState(today);
  return (
    <Stack
      gap="md"
      className={mode === "people" ? classes.tablePage : undefined}
    >
      <PageHeader title="Capacity" />
      {modes.length > 1 && (
        <Group>
          <SegmentedControl
            aria-label="What the page shows"
            size="xs"
            value={mode}
            onChange={(next) => {
              onMode(capacityModeSchema.parse(next));
            }}
            data={modes.map((one) => ({
              value: one,
              // The mode is always one of the typed modes, each a key of the labels.
              // eslint-disable-next-line security/detect-object-injection
              label: modeLabels[one],
            }))}
          />
        </Group>
      )}
      {mode === "settings" ? (
        <PlanningSettingsTab canEdit={canEditSettings} />
      ) : (
        <CapacityPeople
          byManager={byManager}
          now={now}
          view={view}
          onView={onView}
        />
      )}
    </Stack>
  );
}
