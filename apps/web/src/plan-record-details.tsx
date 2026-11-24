// SPDX-License-Identifier: Apache-2.0

// The values of a plan record open beside its table, with a project's dates and milestones.

import type {
  Asking,
  DraftKind,
  Milestone,
  Project,
  RecordRef,
  Show,
} from "@fathom/shared";
import { Button, Group, Menu, Stack, Text } from "@mantine/core";
import { Icon } from "./icons.tsx";
import details from "./record-details.module.css";
import {
  addedColumnsTitle,
  featureColumnGroups,
  releaseColumnKey,
} from "./feature-table.tsx";
import {
  type Identified,
  livePlanRecords,
  NamerName,
  noRecordProblem,
  partsShown,
  type PlanChange,
  RecordName,
} from "./plan-table.tsx";
import {
  dayOrEmpty,
  projectDateColumn,
  projectDateColumns,
} from "./project-grids.tsx";
import {
  type PlanRecord,
  type PlanTab,
  streamOfReleaseGroup,
} from "./projects.ts";
import {
  inUnitsWords,
  RecordLinkList,
  RecordSection,
  Row,
  DetailSections,
} from "./record-details.tsx";
import { inViewUnits } from "./grid-columns.tsx";
import { heldBack } from "./grid-drafts.ts";
import type { Column } from "./record-table.ts";
import {
  type Editing,
  useChosenUnits,
  useRecordEditing,
} from "./record-editing.tsx";
import type { NoteContext, NoteOpening } from "./note-editing.tsx";
import { noOthers } from "./new-plan-record-panel.tsx";
import { type RecordNode, recordNode } from "./record-drafts.ts";
import { noDrafts } from "./drafts.ts";
import { usePublishDraft } from "./publish-draft.tsx";
import { RecordMenu } from "./record-menu.tsx";
import {
  besideLive,
  DraftedItem,
  MarkRow,
  useDraftView,
} from "./status-mark.tsx";
import type { CellValue, View } from "./table-view.ts";
import { formatDay } from "./day-formats.ts";

// The kind of a record in a table of one kind.
export const onlyKind = "";

export interface MilestoneMenu {
  decide: (asking: Asking, ref: RecordRef) => void;
  discard: (milestone: Milestone) => void;
  resubmit: (milestone: Milestone) => void;
  remove: (milestone: Milestone) => void;
  edit: (project: Project, milestone?: Milestone) => void;
}

// What a panel's links show: a record on one of the plan's tabs, or a stream on Releases.
export interface Follow {
  showRecord: (tab: PlanTab, id: string) => void;
  showStream: (streamId: string) => void;
}

const onTabOf =
  (tab: PlanTab) =>
  (follow: Follow, id: string): void => {
    follow.showRecord(tab, id);
  };

// How each column's values are followed, for those that can be: to the records they name, or, for
// a feature's release, to its stream.
const linkedPages = new Map<string, (follow: Follow, id: string) => void>([
  ["customerIds", onTabOf("customers")],
  ["projectIds", onTabOf("projects")],
  ["proposalIds", onTabOf("proposals")],
  ["featureIds", onTabOf("features")],
  [
    releaseColumnKey,
    (follow, id) => {
      follow.showStream(streamOfReleaseGroup(id));
    },
  ],
]);

// The records a panel's links can name with an ID of their own, by identifier.
type IdentifiedRecords = ReadonlyMap<string, Identified>;

function RecordLinks({
  column,
  ids,
  identified,
  onShow,
}: {
  column: Column<never, PlanChange>;
  ids: readonly string[];
  identified: IdentifiedRecords;
  onShow: (id: string) => void;
}) {
  const named = ids.flatMap((id) => {
    const choice = column.choices.find((one) => one.id === id);
    return choice === undefined ? [] : [choice];
  });
  return (
    <RecordLinkList
      links={named.map(({ id, label }) => ({
        id,
        name: <RecordName record={identified.get(id) ?? { id, name: label }} />,
        onShow: () => {
          onShow(id);
        },
      }))}
    />
  );
}

// A record's values, as its table shows them, each changed in place as in its cell by those who may.
export function PlanRecordDetails({
  columns,
  units,
  record,
  ownDraft,
  canEdit,
  identified,
  follow,
  onChange,
  sections,
  notes,
}: {
  columns: readonly Column<never, PlanChange>[];
  units: Pick<View, "units" | "places">;
  record: PlanRecord;
  // The record's draft, whatever the Draft view, which decides how its marks show.
  ownDraft: PlanRecord["draft"] | undefined;
  canEdit: boolean;
  identified: IdentifiedRecords;
  follow: Follow;
  onChange: (change: PlanChange) => void;
  // The parts its details are shown in, any column none names in a last part of its own; or one
  // list of its columns, in the table's order.
  sections?: typeof featureColumnGroups | undefined;
  // Opens a note, which the page holds, since a note is written in a panel of its own.
  notes: NoteOpening;
}) {
  const { closeStale, editingOf } = useRecordEditing<
    never,
    PlanChange,
    NoteContext<never, PlanChange>
  >(notes);
  // A column that offers units is edited in the unit the table shows at first, as a new record's
  // is, and the unit can be changed while editing without changing the table.
  const editUnits = useChosenUnits(units.units);
  const rows = columns.map((column) => ({
    column,
    edited: inViewUnits(column, { units: editUnits.units }),
  }));
  const values = Object.fromEntries(
    rows.map(({ edited }) => [edited.key, edited.value(record as never)]),
  );
  const context: NoteContext<never, PlanChange> = {
    id: record.id,
    name: record.name,
    kind: onlyKind,
    values,
    save:
      canEdit && !heldBack(record)
        ? (change) => {
            onChange(change);
          }
        : undefined,
    others: noOthers,
    recordProblem: noRecordProblem,
    onUnit: (column, unit) => {
      editUnits.choose(column.key, unit);
    },
  };
  closeStale(context);
  const editing = editingOf(context);
  const rowOf = ({ column, edited }: (typeof rows)[number]) => (
    <DetailRow
      key={column.key}
      column={column}
      units={units}
      record={record}
      value={column.value(record as never)}
      ownDraft={ownDraft}
      editing={editing(edited)}
      identified={identified}
      follow={follow}
    />
  );
  if (sections === undefined) {
    return <dl className={details.list}>{rows.map(rowOf)}</dl>;
  }
  const named = new Set(sections.flatMap(({ keys }) => keys));
  const others = {
    title: addedColumnsTitle,
    keys: rows.map(({ column }) => column.key).filter((key) => !named.has(key)),
  };
  return (
    <DetailSections>
      {[...sections, others].map((section, index) => {
        const shown = section.keys.flatMap((key) =>
          rows.filter(({ column }) => column.key === key),
        );
        if (shown.length === 0) return null;
        return (
          <RecordSection
            key={section.title}
            id={`record-section-${String(index)}`}
            title={section.title}
          >
            {shown.map(rowOf)}
          </RecordSection>
        );
      })}
    </DetailSections>
  );
}

function DetailRow({
  column,
  units,
  record,
  value,
  ownDraft,
  editing,
  identified,
  follow,
}: {
  column: Column<never, PlanChange>;
  // The units and decimal places the table shows its columns in.
  units: Pick<View, "units" | "places">;
  record: PlanRecord;
  value: CellValue;
  ownDraft: PlanRecord["draft"] | undefined;
  editing: Editing | undefined;
  identified: IdentifiedRecords;
  follow: Follow;
}) {
  const draft =
    ownDraft?.action === "changed" && ownDraft.changed.includes(column.key)
      ? ownDraft
      : undefined;
  const linkedPage = linkedPages.get(column.key);
  const also = inUnitsWords(column, units, record);
  const show = useDraftView();
  // Records naming this one are listed as the Draft view lists them, each named and marked by its
  // own part, so one a draft removes still shows.
  const namers =
    column.parts === undefined
      ? undefined
      : partsShown(column.parts(record.id), show);
  const shown =
    linkedPage !== undefined && namers !== undefined ? (
      namers.length === 0 ? undefined : (
        <RecordLinkList
          links={namers.map((part) => ({
            id: part.record.id,
            name: <RecordName record={part.record} />,
            onShow: () => {
              linkedPage(follow, part.record.id);
            },
            around: (link) => (
              <NamerName part={part} live={show === "live"}>
                {link}
              </NamerName>
            ),
          }))}
        />
      )
    ) : linkedPage !== undefined && Array.isArray(value) && value.length > 0 ? (
      <RecordLinks
        column={column}
        ids={value}
        identified={identified}
        onShow={(id) => {
          linkedPage(follow, id);
        }}
      />
    ) : also !== undefined ? (
      <Text>{also}</Text>
    ) : undefined;
  return (
    <Row
      column={column}
      value={value}
      changed={
        draft === undefined
          ? undefined
          : { live: column.live(draft as never), draft }
      }
      editing={editing}
    >
      {shown}
    </Row>
  );
}

// A project's dates, from its milestones, with the live ones under any its milestones' drafts
// change, and its milestones, each with its menu.
export function ProjectExtras({
  project,
  show,
  canEdit,
  approves,
  nodes,
  menu,
  showMilestones,
}: {
  project: Project;
  show: Show;
  canEdit: boolean;
  approves: readonly DraftKind[];
  nodes: readonly RecordNode[];
  menu: MilestoneMenu;
  showMilestones: (project: Project) => void;
}) {
  const editable = canEdit && project.draft?.action !== "deleted";
  const publishDraft = usePublishDraft();
  const milestones =
    show === "live" ? livePlanRecords(project.milestones) : project.milestones;
  return (
    <>
      <dl className={details.list}>
        {projectDateColumns.map(([key, label]) => {
          const column = projectDateColumn(key, label);
          const live =
            besideLive(show) && project.draft?.action !== "created"
              ? // The key is always one of the fixed dates.
                // eslint-disable-next-line security/detect-object-injection
                project.liveDates?.[key]
              : undefined;
          return (
            <Row
              key={key}
              column={column}
              value={column.value(project)}
              changed={
                // eslint-disable-next-line security/detect-object-injection
                live === undefined || live === project.dates[key]
                  ? undefined
                  : { live: dayOrEmpty(live) }
              }
            />
          );
        })}
      </dl>
      <section aria-labelledby="project-milestones">
        <Group justify="space-between" mb={4}>
          <Text component="h3" id="project-milestones" fz="sm" fw={600} m={0}>
            Milestones
          </Text>
          <Button
            variant="subtle"
            size="compact-sm"
            onClick={() => {
              showMilestones(project);
            }}
          >
            Show milestones
          </Button>
        </Group>
        {milestones.length === 0 && (
          <Text fz="sm" c="dimmed">
            None
          </Text>
        )}
        <Stack gap={0}>
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={[details.row, details.itemRow].join(" ")}
            >
              <div>
                <MarkRow>
                  <DraftedItem
                    draft={milestone.draft}
                    heldBy={milestone.heldBy}
                  >
                    <Text
                      fz="sm"
                      td={
                        milestone.draft?.action === "deleted"
                          ? "line-through"
                          : undefined
                      }
                    >
                      {milestone.name}
                    </Text>
                  </DraftedItem>
                </MarkRow>
                <Text fz="xs" c="dimmed">
                  {formatDay(milestone.date)}
                  {milestone.customerDelivery && ", customer delivery"}
                </Text>
              </div>
              <RecordMenu
                title={milestone.name}
                node={recordNode("milestone", milestone, "")}
                canEditDraft={canEdit}
                actions={{
                  approves,
                  nodes,
                  decide: menu.decide,
                  resubmit: () => {
                    menu.resubmit(milestone);
                  },
                  discard: () => {
                    menu.discard(milestone);
                  },
                  publish:
                    publishDraft &&
                    ((ref) => {
                      publishDraft({ ...noDrafts(), records: [ref] });
                    }),
                }}
              >
                {canEdit &&
                milestone.heldBy === undefined &&
                milestone.draft?.action !== "deleted" ? (
                  <>
                    <Menu.Item
                      onClick={() => {
                        menu.edit(project, milestone);
                      }}
                    >
                      Edit…
                    </Menu.Item>
                    {milestone.draft?.action !== "created" && (
                      <Menu.Item
                        color="red"
                        onClick={() => {
                          menu.remove(milestone);
                        }}
                      >
                        Remove milestone
                      </Menu.Item>
                    )}
                  </>
                ) : undefined}
              </RecordMenu>
            </div>
          ))}
        </Stack>
        {editable && (
          <Button
            variant="default"
            size="compact-sm"
            mt={4}
            leftSection={<Icon name="plus" size={14} />}
            onClick={() => {
              menu.edit(project);
            }}
          >
            Add milestone
          </Button>
        )}
      </section>
    </>
  );
}
