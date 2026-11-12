// SPDX-License-Identifier: Apache-2.0

// The Capacity page, in tabs kept in the address: for now only Settings, the planning settings that
// capacity and forecasts are worked out with.

import { Stack, Tabs } from "@mantine/core";
import { z } from "zod";
import { PageHeader } from "./page-header.tsx";
import { PlanningSettingsTab } from "./planning-settings-tab.tsx";

const capacityTabs = ["settings"] as const;

export const capacityTabSchema = z.enum(capacityTabs);

export type CapacityTab = z.infer<typeof capacityTabSchema>;

const tabLabels: Record<CapacityTab, string> = { settings: "Settings" };

export function CapacityPage({
  tab,
  onTab,
  canEditSettings,
}: {
  tab: CapacityTab;
  onTab: (tab: CapacityTab) => void;
  canEditSettings: boolean;
}) {
  return (
    <Stack gap="lg">
      <PageHeader title="Capacity" />
      <Tabs
        value={tab}
        onChange={(next) => {
          onTab(capacityTabSchema.parse(next));
        }}
      >
        <Tabs.List>
          {capacityTabs.map((one) => (
            <Tabs.Tab key={one} value={one}>
              {
                // The tab is one of the typed tabs, each a key of the labels.
                // eslint-disable-next-line security/detect-object-injection
                tabLabels[one]
              }
            </Tabs.Tab>
          ))}
        </Tabs.List>
      </Tabs>
      <PlanningSettingsTab canEdit={canEditSettings} />
    </Stack>
  );
}
