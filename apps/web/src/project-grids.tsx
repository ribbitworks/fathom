// SPDX-License-Identifier: Apache-2.0

// The Projects page's tables: customers, projects, proposals, and milestones, each the table of
// records record-grid.tsx sets out, with what is particular to its kind. A record's fields are its
// columns, and its draft's live values are kept by the same names. A project's dates follow from
// its milestones, so are read only. A milestone belongs to the project it was added to, so its
// project is picked only on a new row.

import {
  type Choice,
  type ChangeValue,
  type Customer,
  type CustomerRequest,
  type EffortConversions,
  effortUnitSchema,
  enteredHours,
  exactEffort,
  largestEstimateHours,
  largestIn,
  type Feature,
  featureColumnKeys,
  featureLengths,
  type Meaning,
  type Milestone,
  needsFeatureTeam,
  type Project,
  type ProjectRequest,
  projectLengths,
  type Proposal,
  type ProposalRequest,
  roundedUpTo,
  shownEffort,
  startingEffortConversions,
  typedNumber,
} from "@fathom/shared";
import { Menu, VisuallyHidden } from "@mantine/core";
import type { ReactNode } from "react";
import {
  addedColumn,
  type AddedColumns,
  cellRequest,
} from "./added-columns.ts";
import { type CellChange, cellKinds, flagChoice } from "./cell-kinds.tsx";
import { EffortCell } from "./effort-cell.tsx";
import { effortColumnUnits, hoursWords } from "./effort.ts";
import { decimalUpTo } from "./numbers.ts";
import type { DraftField } from "./draft-details.tsx";
import { noDrafts } from "./drafts.ts";
import { choice, offered } from "./lists.ts";
import {
  cycleChoiceId,
  type FeatureFields,
  isFeature,
  type MilestoneAdding,
  type PlanRecord,
  type PlanRecordKind,
  type PlanTab,
  type TableChoices,
  targetOf,
} from "./projects.ts";
import { ShowDetailsButton } from "./show-details-button.tsx";
import { StatusMark } from "./status-mark.tsx";
import {
  fieldColumn,
  inOrder,
  liveRecordsBy,
  liveRecordsOf,
  type Column,
  isPending,
  RecordGrid,
  type RecordGridProps,
  type RecordTable,
  type RowGrouping,
} from "./record-grid.tsx";
import { type CellValue, type ColumnUnit, formatMonth } from "./table-view.ts";

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

// Records as they are live, without drafts: those only drafted to be added are left out, and each
// field a draft changes has its live value back.
export function livePlanRecords<Rec extends PlanRecord>(
  records: readonly Rec[],
): Rec[] {
  return records.flatMap((record) =>
    isFeature(record)
      ? (liveRecordsOf([record], featureDetailKeys) as Rec[])
      : liveRecordsBy([withLiveDates(record)], (_record, draft, rest) => ({
          ...rest,
          ...Object.fromEntries(
            Object.entries(draft.live as object).filter(([key]) =>
              draft.changed.includes(key),
            ),
          ),
        })),
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
function field<Rec extends PlanRecord>(
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

const named = (
  records: readonly {
    id: string;
    name: string;
    draft?: { action: string } | undefined;
  }[],
): Choice[] =>
  records.map(({ id, name, draft }) =>
    choice(id, name, draft?.action === "deleted"),
  );

// What a record's draft changes, field by field, with each value as the table shows it.
function draftFieldsOf<Rec extends PlanRecord>(
  columns: readonly Column<Rec, PlanChange>[],
  record: Rec,
  draft: NonNullable<PlanRecord["draft"]>,
): DraftField[] {
  if (draft.action !== "changed") return [];
  const words = (column: Column<Rec, PlanChange>, value: CellValue) =>
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

function planTable<Rec extends PlanRecord, Request>({
  type,
  label,
  one,
  noun,
  columns,
  request,
  menuItems,
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
  menuItems: (record: Rec) => ReactNode;
  kinds?: readonly string[];
  groupings?: readonly RowGrouping<Rec>[];
  nameOf?: (record: Rec) => string;
}): RecordTable<Rec, PlanChange, Request> {
  return {
    label,
    one,
    noun,
    ...(kinds === undefined ? {} : { kinds, kindOf: () => savedKind }),
    ...(groupings === undefined ? {} : { groupings }),
    newRowLabel: () => `New ${one}`,
    removeLabel: () => `Remove ${one}`,
    nameOf,
    columnsFor: (fields, lists, order) => columns({ fields, lists, order }),
    liveRecords: livePlanRecords,
    draftFields: (record, draft, fields, lists) =>
      draftFieldsOf(columns({ fields, lists, order: [] }), record, draft),
    recordProblem: noRecordProblem,
    request: (changes) => request(changes),
    drafts: drafts(type),
    menuItems,
  };
}

const merged = (changes: PlanChange[]): PlanChange =>
  Object.assign({}, ...changes) as PlanChange;

const nameColumn = <Rec extends PlanRecord>(
  onOpen: ((record: Rec) => void) | undefined,
): Column<Rec, PlanChange> => ({
  ...field<Rec>("name", "Name", "text", {
    required: true,
    maxLength: projectLengths.name,
  }),
  ...(onOpen === undefined
    ? {}
    : {
        mark: (record: Rec) =>
          !isPending(record) && (
            <ShowDetailsButton
              name={(record as { name: string }).name}
              onOpen={() => {
                onOpen(record);
              }}
            />
          ),
      }),
});

const detailsItem =
  <Rec extends PlanRecord>(onOpen: ((record: Rec) => void) | undefined) =>
  (record: Rec): ReactNode =>
    onOpen !== undefined &&
    !isPending(record) && (
      <Menu.Item
        onClick={() => {
          onOpen(record);
        }}
      >
        Show details
      </Menu.Item>
    );

export function customerTable(
  onOpen?: (customer: Customer) => void,
): RecordTable<Customer, PlanChange, CustomerRequest> {
  return planTable<Customer, CustomerRequest>({
    type: "customer",
    ...wordsOf("customers"),
    columns: () => [nameColumn(onOpen)],
    request: (changes) => merged(changes) as CustomerRequest,
    menuItems: detailsItem(onOpen),
  });
}

const idColumn = <Rec extends PlanRecord>(label: string) =>
  field<Rec>("externalId", label, "text", {
    maxLength: projectLengths.externalId,
  });

const ownerColumn = <Rec extends PlanRecord>(people: Choice[]) =>
  field<Rec>("ownerId", "Owner", "choice", {
    choices: people,
    emptyLabel: "No owner",
  });

const customersColumn = <Rec extends PlanRecord>(
  customers: readonly Customer[],
) =>
  field<Rec>("customerIds", "Customers", "choice", {
    choices: named(customers),
    multiple: true,
  });

// The columns of a project's dates, which follow from its milestones.
export const projectDateColumns: readonly [keyof Project["dates"], string][] = [
  ["first", "First milestone"],
  ["last", "Last milestone"],
  ["nextDelivery", "Next delivery"],
];

export const dayOrEmpty = (day: string | null) => day ?? "";

export const projectDateColumn = (
  key: keyof Project["dates"],
  label: string,
): Column<Project, PlanChange> => ({
  ...field<Project>(key, label, "date", { readOnly: true }),
  // The key is always one of the fixed dates.
  // eslint-disable-next-line security/detect-object-injection
  value: (project) => dayOrEmpty(project.dates[key]),
  live: () => "",
  change: () => ({}),
});

export function projectColumns(
  choices: TableChoices,
  onOpen?: (project: Project) => void,
): Column<Project, PlanChange>[] {
  return [
    nameColumn(onOpen),
    idColumn<Project>("Project ID"),
    ownerColumn<Project>(choices.people),
    customersColumn<Project>(choices.customers),
    field<Project>("proposalIds", "Proposals", "choice", {
      choices: named(choices.proposals),
      multiple: true,
    }),
    ...projectDateColumns.map(([key, label]) => projectDateColumn(key, label)),
  ];
}

export function projectTable(
  choices: TableChoices,
  onOpen?: (project: Project) => void,
  onMilestones?: (project: Project) => void,
): RecordTable<Project, PlanChange, ProjectRequest> {
  return planTable<Project, ProjectRequest>({
    type: "project",
    ...wordsOf("projects"),
    columns: () => projectColumns(choices, onOpen),
    request: (changes) => merged(changes) as ProjectRequest,
    menuItems: (project) =>
      !isPending(project) && (
        <>
          {detailsItem(onOpen)(project)}
          {onMilestones !== undefined && (
            <Menu.Item
              onClick={() => {
                onMilestones(project);
              }}
            >
              Show milestones
            </Menu.Item>
          )}
        </>
      ),
  });
}

// The first status offered, of a meaning when one is named, as a value in a cell.
function firstStatus(statuses: readonly Choice[], meaning?: Meaning): string[] {
  const first = statuses.find(
    (status) =>
      offered(status) && (meaning === undefined || status.meaning === meaning),
  );
  return first === undefined ? [] : [first.id];
}

export function proposalColumns(
  choices: TableChoices,
  onOpen?: (proposal: Proposal) => void,
): Column<Proposal, PlanChange>[] {
  return [
    nameColumn(onOpen),
    idColumn<Proposal>("Proposal ID"),
    field<Proposal>("link", "Link", "link"),
    ownerColumn<Proposal>(choices.people),
    customersColumn<Proposal>(choices.customers),
    {
      ...field<Proposal>("statusId", "Status", "choice", {
        required: true,
        choices: choices.statuses,
      }),
      // A new proposal starts in the first status offered.
      newRowValue: () => firstStatus(choices.statuses),
    },
  ];
}

export function proposalTable(
  choices: TableChoices,
  onOpen?: (proposal: Proposal) => void,
): RecordTable<Proposal, PlanChange, ProposalRequest> {
  return planTable<Proposal, ProposalRequest>({
    type: "proposal",
    ...wordsOf("proposals"),
    columns: () => proposalColumns(choices, onOpen),
    request: (changes) => merged(changes) as ProposalRequest,
    menuItems: detailsItem(onOpen),
  });
}

// A new row is of its own kind, so its project can be picked; a milestone saved keeps its project.
const newKind = "new";
const savedKind = "saved";

export function milestoneColumns(
  projects: readonly Project[],
  filteredTo?: string,
): Column<Milestone, PlanChange>[] {
  return [
    field<Milestone>("name", "Name", "text", {
      required: true,
      maxLength: projectLengths.name,
    }),
    {
      ...field<Milestone>("projectId", "Project", "choice", {
        required: true,
        choices: named(projects),
      }),
      readOnlyOn: (kind) => kind === savedKind,
      ...(filteredTo === undefined ? {} : { newRowValue: () => [filteredTo] }),
    },
    field<Milestone>("date", "Date", "date", { required: true }),
    field<Milestone>("customerDelivery", "Customer delivery", "flag", {
      emptyLabel: "No",
    }),
  ];
}

export function milestoneTable(
  projects: readonly Project[],
  filteredTo?: string,
  onProject?: (milestone: Milestone) => void,
): RecordTable<Milestone, PlanChange, MilestoneAdding> {
  return planTable<Milestone, MilestoneAdding>({
    type: "milestone",
    ...wordsOf("milestones"),
    kinds: [newKind, savedKind],
    columns: () => milestoneColumns(projects, filteredTo),
    request: (changes) => {
      const { customerDelivery, ...rest } = merged(changes);
      return {
        ...rest,
        customerDelivery: customerDelivery === true,
      } as MilestoneAdding;
    },
    menuItems: (milestone) =>
      onProject !== undefined &&
      !isPending(milestone) && (
        <Menu.Item
          onClick={() => {
            onProject(milestone);
          }}
        >
          Show project
        </Menu.Item>
      ),
  });
}

const cycleOf = (target: {
  targetStreamId?: string | null | undefined;
  targetCycle?: string | null | undefined;
}): string[] =>
  typeof target.targetStreamId === "string" &&
  typeof target.targetCycle === "string"
    ? [cycleChoiceId(target.targetStreamId, target.targetCycle)]
    : [];

// Estimates are rough, so their amounts show no more than two decimal places, rounded up.
const effortPlaces = [0, 1, 2];
const effortPlacesAtFirst = 2;
// What floating point leaves of an amount that was not rounded, far below any place shown.
const roundingLeft = 1e-9;

// A feature's estimate, kept in hours and shown in the unit the view names, in which it is typed.
// Without the conversions, as for a draft's details, it is offered in hours alone, which need none.
function effortColumn(
  conversions: EffortConversions | undefined,
): Column<Feature, PlanChange> {
  const [hours, ...others] = effortColumnUnits;
  const converting = conversions ?? startingEffortConversions;
  const shownIn = (
    unit: ColumnUnit,
    places: number,
  ): Column<Feature, PlanChange> => {
    const effortUnit = effortUnitSchema.catch(hours.key).parse(unit.key);
    const amountOf = (estimate: number) =>
      shownEffort(estimate, effortUnit, converting);
    const inUnit = (estimate: unknown) =>
      typeof estimate === "number" ? String(amountOf(estimate)) : "";
    return {
      ...field<Feature>("estimateHours", "Effort", "number"),
      unit,
      least: 0,
      most: largestIn(largestEstimateHours, effortUnit, converting),
      value: (feature) => inUnit(feature.estimateHours),
      live: (draft) => inUnit((draft.live as Partial<Feature>).estimateHours),
      change: (value) => {
        const typed = typedNumber(value as string);
        return {
          estimateHours:
            typed === undefined
              ? null
              : enteredHours(typed, effortUnit, converting),
        };
      },
      content: ({ estimateHours }) => {
        if (estimateHours === null) return null;
        const amount = roundedUpTo(amountOf(estimateHours), places);
        const exact = exactEffort(estimateHours, effortUnit, converting);
        return (
          <EffortCell
            shown={decimalUpTo(amount, places)}
            amount={amount}
            unit={unit}
            hours={hoursWords(
              estimateHours,
              Math.abs(amount - exact) > roundingLeft,
            )}
          />
        );
      },
    };
  };
  return {
    ...shownIn(hours, effortPlacesAtFirst),
    // Breaking down by effort counts only whether features have an estimate, which says little.
    breaksDown: false,
    units: {
      offered: conversions === undefined ? [hours] : [hours, ...others],
      places: { offered: effortPlaces, starting: effortPlacesAtFirst },
      shownIn,
    },
  };
}

export function featureColumns(
  choices: TableChoices,
  onOpen?: (feature: Feature) => void,
  { fields, lists, order }: AddedColumns = choices.featureColumns,
): Column<Feature, PlanChange>[] {
  const meaningOf = new Map(
    choices.featureStatuses.map(({ id, meaning }) => [id, meaning]),
  );
  const builtIn: Column<Feature, PlanChange>[] = [
    nameColumn<Feature>(onOpen),
    {
      ...field<Feature>("statusId", "Status", "choice", {
        required: true,
        choices: choices.featureStatuses,
      }),
      newRowValue: () => firstStatus(choices.featureStatuses, "possible"),
    },
    field<Feature>("neededBy", "Needed by", "month"),
    customersColumn<Feature>(choices.customers),
    field<Feature>("description", "Description", "text", {
      maxLength: featureLengths.description,
    }),
    field<Feature>("note", "Notes", "note"),
    {
      ...field<Feature>("targetCycle", "Target cycle", "choice", {
        choices: choices.cycles,
        emptyLabel: "Later",
      }),
      value: cycleOf,
      live: (draft) => cycleOf(draft.live as Partial<Feature>),
      change: (value) => targetOf((value as string[]).at(0)),
    },
    effortColumn(choices.effortConversions),
    {
      ...field<Feature>("featureTeamId", "Feature team", "choice", {
        choices: choices.featureTeams,
        emptyLabel: "No feature team",
      }),
      mark: (feature) =>
        needsFeatureTeam(
          meaningOf.get(feature.statusId),
          feature.featureTeamId,
        ) && (
          <StatusMark tone="warning">
            No team
            <VisuallyHidden>: it needs a feature team to own it</VisuallyHidden>
          </StatusMark>
        ),
    },
  ];
  return inOrder(
    [
      ...builtIn,
      // A value can be given only in a column already approved.
      ...fields.map((added) => ({
        ...addedColumn<Feature, CellChange>(added, lists),
        readOnly: added.draft?.action === "created",
      })),
    ],
    order,
  );
}

const laterGroup = "later";

// The rows' groups: each cycle in the choices' order, then Later.
function byCycle(cycles: readonly Choice[]): RowGrouping<Feature> {
  const placeOf = new Map(
    cycles.map((offered, rank) => [offered.id, { offered, rank }]),
  );
  return {
    key: "targetCycle",
    label: "Cycle",
    of: (feature) => {
      const [cycle = ""] = cycleOf(feature);
      const place = placeOf.get(cycle);
      return place === undefined
        ? { key: laterGroup, label: "Later", rank: cycles.length }
        : { key: cycle, label: place.offered.label, rank: place.rank };
    },
  };
}

// The rows' groups: each month a feature is needed by, earliest first, then those with none.
const byNeededBy: RowGrouping<Feature> = {
  key: "neededBy",
  label: "Needed by",
  of: ({ neededBy }) =>
    neededBy === null
      ? { key: "no-date", label: "No date", rank: Number.MAX_SAFE_INTEGER }
      : {
          key: neededBy,
          label: formatMonth(neededBy),
          rank: Number(neededBy.replace("-", "")),
        },
};

export function featureTable(
  choices: TableChoices,
  onOpen?: (feature: Feature) => void,
): RecordTable<Feature, PlanChange, FeatureFields> {
  return planTable<Feature, FeatureFields>({
    type: "feature",
    ...wordsOf("features"),
    columns: (shown) => featureColumns(choices, onOpen, shown),
    groupings: [byCycle(choices.cycles), byNeededBy],
    request: (changes) => {
      const request: PlanChange = {
        ...merged(changes),
        ...cellRequest(changes),
      };
      return request as FeatureFields;
    },
    menuItems: detailsItem(onOpen),
  });
}

// The plan's tables have no columns that can be edited.
const ignoreColumn = () => undefined;
export const noColumnActions = {
  editColumn: ignoreColumn,
  discardColumn: ignoreColumn,
  resubmitColumn: ignoreColumn,
};

// One of the page's tables, with no added columns or column drafts of its own.
export function PlanGrid<Rec extends PlanRecord, Request>(
  props: Omit<
    RecordGridProps<Rec, PlanChange, Request>,
    "fields" | "order" | "lists" | "canEditColumns"
  >,
) {
  return (
    <RecordGrid
      {...props}
      fields={[]}
      order={[]}
      lists={[]}
      canEditColumns={false}
    />
  );
}

// What a plan record's draft changes, field by field, named and worded as its table shows them.
const draftColumns: Readonly<
  Record<
    PlanRecordKind,
    (choices: TableChoices) => readonly Column<never, PlanChange>[]
  >
> = {
  customer: () => [nameColumn<Customer>(undefined)],
  project: projectColumns,
  proposal: proposalColumns,
  milestone: (choices) => milestoneColumns(choices.projects),
  feature: (choices) => featureColumns(choices),
};

export function planDraftFields(
  kind: PlanRecordKind,
  record: PlanRecord,
  choices: TableChoices,
): DraftField[] {
  if (record.draft === undefined) return [];
  // The kind is always one of the fixed kinds above.
  // eslint-disable-next-line security/detect-object-injection
  const columns = draftColumns[kind](choices);
  return draftFieldsOf(columns, record as never, record.draft);
}
