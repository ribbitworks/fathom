// SPDX-License-Identifier: Apache-2.0

// A project's activities in its details: each linked to its own details, with its total effort and
// its menu, and Add activity under them.

import type { DraftKind, Project } from "@fathom/shared";
import { Button, Menu, Stack, Text } from "@mantine/core";
import type { PlanChange } from "./plan-table.tsx";
import { changeablePart, type PartMenu, PartRow } from "./project-parts.tsx";
import type { ProjectActivity } from "./projects.ts";
import { inUnitsWords, RecordLink } from "./record-details.tsx";
import type { RecordNode } from "./record-drafts.ts";
import type { Column } from "./record-table.ts";
import type { View } from "./table-view.ts";

export const addActivityId = "add-activity";

// The link to an activity's details, which focus goes back to once they close.
export const activityLinkId = (activityId: string) =>
  `activity-link-${activityId}`;

export interface ActivityMenu extends PartMenu<ProjectActivity> {
  open: (activity: ProjectActivity) => void;
  add: (project: Project) => void;
}

export function ProjectActivities({
  project,
  activities,
  effort,
  units,
  canEdit,
  approves,
  nodes,
  menu,
}: {
  project: Project;
  // The project's activities, as the Draft view shows them.
  activities: readonly ProjectActivity[];
  // The column their total effort is shown by, in the units the table shows.
  effort: Column<ProjectActivity, PlanChange>;
  units: Pick<View, "units" | "places">;
  canEdit: boolean;
  approves: readonly DraftKind[];
  nodes: readonly RecordNode[];
  menu: ActivityMenu;
}) {
  const editable = canEdit && project.draft?.action !== "deleted";
  return (
    <section aria-labelledby="project-activities">
      <Text component="h3" id="project-activities" fz="sm" fw={600} mb={4}>
        Activities
      </Text>
      {activities.length === 0 && (
        <Text fz="sm" c="dimmed">
          None
        </Text>
      )}
      <Stack gap={0}>
        {activities.map((activity) => {
          const total = inUnitsWords(effort, units, activity);
          return (
            <PartRow
              key={activity.id}
              kind="project-activity"
              part={activity}
              name={
                <RecordLink
                  id={activityLinkId(activity.id)}
                  name={activity.name}
                  onShow={() => {
                    menu.open(activity);
                  }}
                />
              }
              line={total === undefined ? null : `${effort.label}: ${total}`}
              canEdit={canEdit}
              approves={approves}
              nodes={nodes}
              menu={menu}
            >
              <Menu.Item
                onClick={() => {
                  menu.open(activity);
                }}
              >
                Show details
              </Menu.Item>
              {canEdit &&
                changeablePart(activity) &&
                activity.draft?.action !== "created" && (
                  <Menu.Item
                    color="red"
                    onClick={() => {
                      menu.remove(activity);
                    }}
                  >
                    Remove activity
                  </Menu.Item>
                )}
            </PartRow>
          );
        })}
      </Stack>
      {editable && (
        <Button
          id={addActivityId}
          variant="default"
          size="compact-sm"
          mt={4}
          onClick={() => {
            menu.add(project);
          }}
        >
          Add activity
        </Button>
      )}
    </section>
  );
}
