// SPDX-License-Identifier: Apache-2.0

// A project's or a release's activities: its table's Activities column and its details' row.

import type { Activity, Project, Show } from "@fathom/shared";
import { recordsColumn } from "./plan-table.tsx";
import type { Column, GridRecord, ShowOn } from "./record-table.ts";
import { ShortList } from "./short-list.tsx";

export const activitiesColumnKey = "activityIds";

// Features and activities are changed by those who edit features, and never in the Live view.
export const editsFeatureKinds = (canEditFeatures: boolean, show: Show) =>
  canEditFeatures && show !== "live";

// The field by which an activity belongs to its project or its release.
export type ActivityOwner = "projectId" | "releaseId";

export const activitiesIn = (
  activities: readonly Activity[],
  owner: ActivityOwner,
  id: string,
) =>
  activities.filter(
    ({ projectId, releaseId }) =>
      (owner === "projectId" ? projectId : releaseId) === id,
  );

// A record's activities on one line, read only, since an activity moves on Activities.
export const activitiesColumn = <
  Rec extends GridRecord & { draft?: { live: object } | undefined },
  Change,
>(
  activities: readonly Activity[],
  owner: ActivityOwner,
  idOf: (row: Rec) => string,
): Column<Rec, Change> =>
  recordsColumn<Rec, Change>(activitiesColumnKey, "Activities", activities, {
    namedBy: (row) =>
      activitiesIn(activities, owner, idOf(row)).map(({ id }) => id),
    readOnly: true,
  });

// Where a record's activities are seen and added, on Activities: all of them, filtered to the
// record, or a new one with the record set.
export interface ActivitiesOf {
  showAll: (id: string) => void;
  add: (id: string) => void;
}

// The ways to Activities, each taken once any unsaved change on the page is kept or dropped.
export const leavingFor = (
  of: ActivitiesOf,
  leave: (go: () => void) => void,
): ActivitiesOf => ({
  showAll: (id) => {
    leave(() => {
      of.showAll(id);
    });
  },
  add: (id) => {
    leave(() => {
      of.add(id);
    });
  },
});

// A record's Activities row: its activities as the view shows them, and whether it takes no new
// one, such as a record being removed.
export interface ActivityRow<Rec> {
  activities: readonly Activity[];
  owner: ActivityOwner;
  idOf: (row: Rec) => string;
  takesNoActivity: (row: Rec) => boolean;
  of: ActivitiesOf;
  onShow: (id: string) => void;
  mayAdd: boolean;
}

// A record's activities shown on Activities, filtered to it, where it has any: by its Activities
// row's name and its menu alike.
export const activitiesShowOn = <Rec,>(
  row: Pick<ActivityRow<Rec>, "activities" | "owner" | "idOf" | "of">,
  record: Rec,
): ShowOn | undefined =>
  activitiesIn(row.activities, row.owner, row.idOf(record)).length === 0
    ? undefined
    : {
        page: "Activities",
        onShow: () => {
          row.of.showAll(row.idOf(record));
        },
      };

// How a project's activities belong to it, and that a project being removed takes no new one.
export const projectActivityFields = {
  owner: "projectId",
  idOf: ({ id }: Project) => id,
  takesNoActivity: ({ draft }: Project) => draft?.action === "deleted",
} as const;

export const listingActivities = <Rec extends GridRecord, Change>(
  columns: readonly Column<Rec, Change>[],
  row: ActivityRow<Rec> | undefined,
): Column<Rec, Change>[] => {
  if (row === undefined) return [...columns];
  return columns.map((column) =>
    column.key === activitiesColumnKey
      ? {
          ...column,
          showOn: (record: Rec) => activitiesShowOn(row, record),
          details: (record: Rec) => (
            <ActivityList
              activities={activitiesIn(
                row.activities,
                row.owner,
                row.idOf(record),
              )}
              onShow={row.onShow}
              onAdd={
                row.mayAdd && !row.takesNoActivity(record)
                  ? () => {
                      row.of.add(row.idOf(record));
                    }
                  : undefined
              }
            />
          ),
        }
      : column,
  );
};

function ActivityList({
  activities,
  onShow,
  onAdd,
}: {
  activities: readonly Activity[];
  onShow: (id: string) => void;
  onAdd?: (() => void) | undefined;
}) {
  return (
    <ShortList
      items={activities}
      noun="activities"
      onShow={onShow}
      actions={
        onAdd === undefined ? [] : [{ label: "Add activity", onClick: onAdd }]
      }
    />
  );
}
