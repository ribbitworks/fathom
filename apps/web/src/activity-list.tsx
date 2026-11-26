// SPDX-License-Identifier: Apache-2.0

// A project's or a release's activities: its table's Activities column and its details' row.

import type { Activity, Project, Show } from "@fathom/shared";
import {
  listParts,
  NamerName,
  partsShown,
  recordsColumn,
} from "./plan-table.tsx";
import type { Column, GridRecord, ShowOn } from "./record-table.ts";
import { ShortList } from "./short-list.tsx";
import type { FormValues } from "./new-record-panel.tsx";
import type { View } from "./table-view.ts";
import { focusSoon } from "./focus.ts";
import { useDraftView } from "./status-mark.tsx";

// Add activity in a record's details, which focus goes back to once its New activity closes.
export const addActivityId = "add-activity";

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

// What New activity starts with on Activities filtered to exactly one project or one release that
// takes activities: that record, as Add activity in its details sets it; otherwise nothing. What it
// starts with isn't anything entered.
export function filteredOwner(
  filters: View["filters"],
  takesActivities: (owner: ActivityOwner, id: string) => boolean,
): FormValues {
  const only = (owner: ActivityOwner) => {
    // The owner is always one of the two fixed ones.
    // eslint-disable-next-line security/detect-object-injection
    const filter = filters[owner];
    const [id, ...more] = filter?.any ?? [];
    return id === undefined || more.length > 0 || filter?.empty === true
      ? undefined
      : id;
  };
  const project = only("projectId");
  const release = only("releaseId");
  if (project !== undefined && release === undefined)
    return takesActivities("projectId", project)
      ? { projectId: [project] }
      : {};
  if (release !== undefined && project === undefined)
    return takesActivities("releaseId", release)
      ? { releaseId: [release] }
      : {};
  return {};
}

// Where a record's activities are seen and added: all of them on Activities, filtered to the record,
// or a new one with the record set, in a form stacked under its details.
export interface ActivitiesOf {
  showAll: (id: string) => void;
  add: (id: string) => void;
}

// Add activity in a record's details: New activity, stacked under them with the record set, which
// puts focus back on Add activity once it closes.
export const addingActivity =
  (
    open: (owner: ActivityOwner, id: string, back: () => void) => void,
    owner: ActivityOwner,
  ) =>
  (id: string) => {
    open(owner, id, () => {
      focusSoon(addActivityId);
    });
  };

// Each, taken once any unsaved change on the page is kept or dropped.
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

// A release takes no new activity while it is being removed, or once its schedule is retired, since
// New activity offers such a release only as retired.
export const releaseTakesNoActivity = (
  release: { draft?: { action: string } | undefined },
  stream: { retired: boolean },
) => release.draft?.action === "deleted" || stream.retired;

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
              parts={listParts(
                row.activities,
                (activity) => activity[row.owner] === row.idOf(record),
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

// A record's activities, each marked with the draft that adds it or takes it away, as the Draft view
// lists them.
function ActivityList({
  parts,
  onShow,
  onAdd,
}: {
  parts: ReturnType<typeof listParts<Activity>>;
  onShow: (id: string) => void;
  onAdd?: (() => void) | undefined;
}) {
  const show = useDraftView();
  return (
    <ShortList
      items={partsShown(parts, show).map((part) => ({
        id: part.record.id,
        name: part.record.name,
        around: (link) => (
          <NamerName part={part} live={show === "live"}>
            {link}
          </NamerName>
        ),
      }))}
      noun="activities"
      onShow={onShow}
      actions={
        onAdd === undefined
          ? []
          : [{ label: "Add activity", onClick: onAdd, id: addActivityId }]
      }
    />
  );
}
