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
  approves,
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
          show={view.show}
          onShow={(show) => {
            onView({ ...view, show }, true);
          }}
        />
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
