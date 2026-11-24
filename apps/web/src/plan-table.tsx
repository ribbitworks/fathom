// SPDX-License-Identifier: Apache-2.0

// What the plan's tables share: their columns, the words for their records, and the table itself.

import {
  type Choice,
  type ChangeValue,
  type Customer,
  featureColumnKeys,
  type Meaning,
  planColumnNames,
  type Project,
  projectLengths,
  type Proposal,
  type RecordKeyOf,
  type Show,
} from "@fathom/shared";
import { Menu, Text } from "@mantine/core";
import { Fragment, type ReactNode } from "react";
import type { AddedColumns } from "./added-columns.ts";
import { cellKinds, flagChoice } from "./cell-kinds.tsx";
import type { DraftField } from "./draft-details.tsx";
import { noDrafts } from "./drafts.ts";
import { choice, offered } from "./lists.ts";
import {
  isFeature,
  type PlanRecord,
  type PlanRecordKind,
  type PlanTab,
  identifiedLabel,
  planRecordKey,
} from "./projects.ts";
import { tipAttribute } from "./table-tips.tsx";
import {
  type DraftedPart,
  DraftedPartItem,
  useDraftView,
} from "./status-mark.tsx";
import { fieldColumn } from "./grid-columns.tsx";
import { isPending } from "./grid-drafts.ts";
import {
  liveRecordsBy,
  withLiveFields,
  liveRecordsOf,
} from "./live-records.ts";
import type {
  Column,
  GridRecord,
  NamingPart,
  RecordTable,
  RowGrouping,
} from "./record-table.ts";
import type { CellValue } from "./table-view.ts";

// A change to one or more of a record's fields, by name.
export type PlanChange = Record<string, unknown>;

// A project's dates come from its milestones, so drafts of those change them without a draft of
// the project.
const withLiveDates = <Rec extends PlanRecord>(record: Rec): Rec =>
  "liveDates" in record && record.liveDates !== undefined
    ? { ...record, dates: record.liveDates }
    : record;

// What a feature's draft names that is the feature's own, rather than an added column's.
const featureDetailKeys: readonly string[] = [
  ...featureColumnKeys,
  "targetStreamId",
];

// Records as they are live, without drafts: those only drafted to be added are left out, each
// field a draft changes has its live value back, and a feature is staffed as allocations are live.
export function livePlanRecords<Rec extends PlanRecord>(
  records: readonly Rec[],
): Rec[] {
  return records.flatMap((record) =>
    isFeature(record)
      ? (liveRecordsOf([record], featureDetailKeys).map((feature) => ({
          ...feature,
          staffed: feature.staffedLive,
        })) as Rec[])
      : liveRecordsBy([withLiveDates(record)], withLiveFields),
  );
}

type Kinds =
  "text" | "date" | "month" | "number" | "choice" | "link" | "note" | "flag";

// What each tab's records are called.
const recordWords: Readonly<
  Record<PlanTab, { label: string; one: string; noun: string }>
> = {
  projects: { label: "Projects", one: "project", noun: "projects" },
  proposals: { label: "Proposals", one: "proposal", noun: "proposals" },
  customers: { label: "Customers", one: "customer", noun: "customers" },
  milestones: { label: "Milestones", one: "milestone", noun: "milestones" },
  features: { label: "Features", one: "feature", noun: "features" },
};

export const wordsOf = (tab: PlanTab) =>
  // The tab is always one of the fixed tabs.
  // eslint-disable-next-line security/detect-object-injection
  recordWords[tab];

// A column reading one of a record's fields, and saving it under the same name.
export function field<Rec extends PlanRecord>(
  key: string,
  label: string,
  kind: Kinds,
  {
    required = false,
    multiple = false,
    choices = [],
    ...others
  }: {
    required?: boolean;
    choices?: Choice[];
    multiple?: boolean;
    maxLength?: number;
    readOnly?: boolean;
    emptyLabel?: string;
  } = {},
): Column<Rec, PlanChange> {
  return fieldColumn<Rec, PlanChange>(key, kind, {
    label,
    required,
    multiple,
    choices: kind === "flag" ? [choice(flagChoice, "Yes", false)] : choices,
    ...others,
  });
}

// A record that may have an ID of its own, such as a Project ID, beside its name.
export interface Identified {
  id: string;
  name: string;
  externalId?: string | null;
  draft?: { action: string } | undefined;
}

// Records offered by their ID, if they have one, then their name, so similar names are told apart.
export const identified = (records: readonly Identified[]): Choice[] =>
  records.map((record) =>
    choice(
      record.id,
      identifiedLabel(record),
      record.draft?.action === "deleted",
    ),
  );

export function RecordName({ record }: { record: Identified }) {
  return (
    <>
      {record.externalId != null && (
        <>
          <Text span inherit c="dimmed">
            {record.externalId}
          </Text>{" "}
        </>
      )}
      {record.name}
    </>
  );
}

// A new row is of its own kind, so what is set only on a saved record, such as a milestone's
// project, can be told apart.
export const newKind = "new";
export const savedKind = "saved";

// What a record's draft changes, field by field, with each value as the table shows it.
export function draftFieldsOf<Rec extends GridRecord, Change>(
  columns: readonly Column<Rec, Change>[],
  record: Rec,
  draft: NonNullable<Rec["draft"]>,
): DraftField[] {
  if (draft.action !== "changed") return [];
  const words = (column: Column<Rec, Change>, value: CellValue) =>
    cellKinds[column.kind].inDetail?.(column, value) ?? (value as ChangeValue);
  return columns
    .filter(({ key }) => draft.changed.includes(key))
    .map((column) => ({
      key: column.key,
      field: {
        field: column.label,
        oldValue: words(column, column.live(draft)),
        newValue: words(column, column.value(record)),
      },
    }));
}

const drafts = (type: PlanRecordKind) => (ids: string[]) => ({
  ...noDrafts(),
  records: ids.map((id) => ({ type, id })),
});

// What a kind of record's table needs besides its columns.
// The plan's records have no rule that takes their values together.
export const noRecordProblem = () => undefined;

// Made once for each kind, so a table's Key column is made again only when its records change.
const keyOf =
  (kind: PlanRecordKind) =>
  (record: PlanRecord): RecordKeyOf =>
    planRecordKey(kind, record);
const planKeyOf: Readonly<
  Record<PlanRecordKind, (record: PlanRecord) => RecordKeyOf>
> = {
  customer: keyOf("customer"),
  project: keyOf("project"),
  proposal: keyOf("proposal"),
  milestone: keyOf("milestone"),
  "project-activity": keyOf("project-activity"),
  feature: keyOf("feature"),
};

export function planTable<Rec extends PlanRecord, Request>({
  type,
  label,
  one,
  noun,
  columns,
  request,
  menuItems,
  showDetails,
  kinds,
  groupings,
  nameOf = (record) => (record as { name: string }).name,
}: {
  type: PlanRecordKind;
  label: string;
  one: string;
  noun: string;
  columns: (shown: AddedColumns) => Column<Rec, PlanChange>[];
  request: (changes: PlanChange[]) => Request;
  menuItems?: (record: Rec) => ReactNode;
  showDetails?: ((record: Rec) => void) | undefined;
  kinds?: readonly string[];
  groupings?: readonly RowGrouping<Rec>[];
  nameOf?: (record: Rec) => string;
}): RecordTable<Rec, PlanChange, Request> {
  return {
    label,
    one,
    noun,
    // The plan's records are General, and so are Features' added columns, so exporting them asks
    // nothing; Features is named for recording all the same, so no classified column escapes it.
    exported: type === "feature" ? { recordedAs: "features" } : {},
    ...(kinds === undefined ? {} : { kinds, kindOf: () => savedKind }),
    ...(groupings === undefined ? {} : { groupings }),
    newRowLabel: () => `New ${one}`,
    removeLabel: () => `Remove ${one}`,
    nameOf,
    nameColumn: "name",
    columnsFor: (fields, lists, order) => columns({ fields, lists, order }),
    liveRecords: livePlanRecords,
    draftFields: (record, draft, fields, lists) =>
      draftFieldsOf(columns({ fields, lists, order: [] }), record, draft),
    recordProblem: noRecordProblem,
    request: (changes) => request(changes),
    drafts: drafts(type),
    ...(menuItems === undefined ? {} : { menuItems }),
    ...(showDetails === undefined ? {} : { showDetails }),
    // The kind is always one of the plan's kinds.
    // eslint-disable-next-line security/detect-object-injection
    keyOf: planKeyOf[type],
  };
}

export const merged = (changes: PlanChange[]): PlanChange =>
  Object.assign({}, ...changes) as PlanChange;

export const nameColumn = <Rec extends PlanRecord>(): Column<Rec, PlanChange> =>
  field<Rec>("name", planColumnNames.name, "text", {
    required: true,
    maxLength: projectLengths.name,
  });

function menuItem<Rec extends PlanRecord>(
  label: string,
  onClick: ((record: Rec) => void) | undefined,
  record: Rec,
): ReactNode {
  return (
    onClick !== undefined && (
      <Menu.Item
        onClick={() => {
          onClick(record);
        }}
      >
        {label}
      </Menu.Item>
    )
  );
}

export const recordMenu =
  <Rec extends PlanRecord>(
    items: readonly [string, ((record: Rec) => void) | undefined][],
  ) =>
  (record: Rec): ReactNode =>
    !isPending(record) &&
    items.map(([label, onClick]) => (
      <Fragment key={label}>{menuItem(label, onClick, record)}</Fragment>
    ));

export const idColumn = <Rec extends PlanRecord>(label: string) =>
  field<Rec>("externalId", label, "text", {
    maxLength: projectLengths.externalId,
  });

export const ownerColumn = <Rec extends PlanRecord>(people: Choice[]) =>
  field<Rec>("ownerId", planColumnNames.ownerId, "choice", {
    choices: people,
    emptyLabel: "No owner",
  });

export const customersColumn = <Rec extends PlanRecord>(
  customers: readonly Customer[],
) =>
  field<Rec>("customerIds", planColumnNames.customerIds, "choice", {
    choices: identified(customers),
    multiple: true,
  });

// Records in a cell, in the order given, each by its ID, dimmed, and its name, drawn as given. A
// long list is cut short, so its tip gives every one, one to a line.
function RecordNames({
  entries,
}: {
  entries: readonly { record: Identified; name: ReactNode }[];
}): ReactNode {
  return (
    <span
      {...{
        [tipAttribute]: entries
          .map(({ record }) => identifiedLabel(record))
          .join("\n"),
      }}
    >
      {entries.map(({ record, name }, index) => (
        <Fragment key={record.id}>
          {index > 0 && ", "}
          {name}
        </Fragment>
      ))}
    </span>
  );
}

// The records a cell names, in the order they are listed.
export function namesCell(records: readonly Identified[]) {
  return (ids: readonly string[]): ReactNode => {
    const picked = records.filter(({ id }) => ids.includes(id));
    return picked.length === 0 ? null : (
      <RecordNames
        entries={picked.map((record) => ({
          record,
          name: <RecordName record={record} />,
        }))}
      />
    );
  };
}

// A link field by which a project or proposal names other records: features or customers.
export type NamingLink = "featureIds" | "customerIds";

// The projects or proposals naming a record through a link field, as drafted and as live: one a
// draft adds it to, or that is only drafted to be added, adds it; one a draft takes it from, or
// removes, takes it away.
export function namingParts(
  records: readonly (Project | Proposal)[],
  link: NamingLink,
  id: string,
): (NamingPart & { record: Project | Proposal })[] {
  return records.flatMap((record) => {
    // The link is one of two fixed field names, on the record as drafted and as live.
    // eslint-disable-next-line security/detect-object-injection
    const named = record[link];
    // eslint-disable-next-line security/detect-object-injection
    const liveNamed = livePlanRecords([record]).at(0)?.[link] ?? [];
    const drafted = record.draft?.action !== "deleted" && named.includes(id);
    const live = liveNamed.includes(id);
    if (!drafted && !live) return [];
    const part: DraftedPart | undefined =
      drafted === live ? undefined : drafted ? "added" : "removed";
    return [{ record, part, live }];
  });
}

// The records naming one that a Draft view lists: as they are live under Live only; as drafted
// once drafts are applied, which leaves out an addition that was rejected; or all of them beside live.
export const partsShown = (
  parts: readonly NamingPart[],
  show: Show,
): NamingPart[] =>
  parts.filter(({ record, part, live }) => {
    if (show === "live") return live;
    return (
      show !== "drafts" ||
      part !== "added" ||
      record.draft?.state !== "rejected"
    );
  });

// A record naming another, marked with its own draft where that adds or takes away the link, as it
// is drafted, or as it is live.
export function NamerName({
  part,
  live,
  children,
}: {
  part: NamingPart;
  live: boolean;
  children: ReactNode;
}) {
  return (
    <DraftedPartItem
      draft={part.part === undefined ? undefined : part.record.draft}
      part={part.part}
      live={live}
    >
      {children}
    </DraftedPartItem>
  );
}

// The projects or proposals naming a record, each marked with its own draft, as the Draft view lists
// them, or as they are live in a Live row.
export function NamersCell({
  parts,
  asLive,
}: {
  parts: readonly NamingPart[];
  asLive: boolean;
}) {
  const show = useDraftView();
  const viewed = asLive ? "live" : show;
  const entries = partsShown(parts, viewed).map((part) => ({
    record: part.record,
    name: (
      <NamerName part={part} live={viewed === "live"}>
        <RecordName record={part.record} />
      </NamerName>
    ),
  }));
  return entries.length === 0 ? null : <RecordNames entries={entries} />;
}

// A column of records named by ID and name, several in one cell, in one line cut short with every
// name in its tip, as any table shows several records; read only where they are worked out.
export function recordsColumn<
  Rec extends GridRecord & { draft?: { live: object } | undefined },
  Change,
>(
  key: string,
  label: string,
  records: readonly Identified[],
  {
    namedBy,
    readOnly = false,
  }: {
    // The records a row names, when they are not its own field.
    namedBy?: ((record: Rec) => string[]) | undefined;
    readOnly?: boolean;
  } = {},
): Column<Rec, Change> {
  const column = fieldColumn<Rec, Change>(key, "choice", {
    label,
    required: false,
    multiple: true,
    choices: identified(records),
    readOnly,
  });
  const value = namedBy ?? ((record: Rec) => column.value(record) as string[]);
  const names = namesCell(records);
  return {
    ...column,
    value,
    content: (record) => names(value(record)),
  };
}

export const pickedColumn = <Rec extends PlanRecord>(
  key: string,
  label: string,
  records: readonly Identified[],
  namedBy?: (record: Rec) => string[],
): Column<Rec, PlanChange> =>
  recordsColumn<Rec, PlanChange>(key, label, records, { namedBy });

// A column of the projects or proposals naming a row's record through a link field, such as those
// needing a feature, as the records given show them, each marked with its own draft, so a change to
// it is a draft of each record added or taken away.
export function namersColumn<Rec extends PlanRecord>(
  key: string,
  label: string,
  records: readonly (Project | Proposal)[],
  // The same records with their drafts, whatever the view, to mark them.
  drafted: readonly (Project | Proposal)[],
  link: NamingLink,
): Column<Rec, PlanChange> {
  const cell = (asLive: boolean) => (record: Rec) => (
    <NamersCell parts={namingParts(drafted, link, record.id)} asLive={asLive} />
  );
  return {
    ...pickedColumn<Rec>(key, label, records, (record) =>
      records
        // The link is always one of the fixed link fields.
        // eslint-disable-next-line security/detect-object-injection
        .filter((namer) => namer[link].includes(record.id))
        .map(({ id }) => id),
    ),
    content: cell(false),
    liveContent: cell(true),
    marksParts: true,
    parts: (id) => namingParts(drafted, link, id),
  };
}

// The first status offered, of a meaning when one is named, as a value in a cell.
export function firstStatus(
  statuses: readonly Choice[],
  meaning?: Meaning,
): string[] {
  const first = statuses.find(
    (status) =>
      offered(status) && (meaning === undefined || status.meaning === meaning),
  );
  return first === undefined ? [] : [first.id];
}
