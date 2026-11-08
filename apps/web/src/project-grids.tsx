// SPDX-License-Identifier: Apache-2.0

// The Projects page's tables: customers, projects, proposals, and milestones, each the table of
// records record-grid.tsx sets out, with what is particular to its kind. A record's fields are its
// columns, and its draft's live values are kept by the same names. A project's dates follow from its
// milestones, so are read only. A milestone belongs to the project it was added to, so its project
// is picked only on a new row.

import {
  type Choice,
  type ChangeValue,
  type Customer,
  type CustomerRequest,
  type Milestone,
  type Project,
  type ProjectRequest,
  projectLengths,
  type Proposal,
  type ProposalRequest,
  type RecordDraft,
} from "@fathom/shared";
import { Menu } from "@mantine/core";
import type { ReactNode } from "react";
import { cellKinds, flagChoice } from "./cell-kinds.tsx";
import type { DraftField } from "./draft-details.tsx";
import { noDrafts } from "./drafts.ts";
import { choice } from "./lists.ts";
import type {
  MilestoneAdding,
  PlanRecord,
  PlanRecordKind,
  ProjectTab,
  TableChoices,
} from "./projects.ts";
import { ShowDetailsButton } from "./show-details-button.tsx";
import {
  fieldColumn,
  liveRecordsBy,
  type Column,
  isPending,
  RecordGrid,
  type RecordGridProps,
  type RecordTable,
} from "./record-grid.tsx";
import type { CellValue } from "./table-view.ts";

// A change to one or more of a record's fields, by name.
export type PlanChange = Record<string, unknown>;

// A project's dates come from its milestones, so drafts of those change them without a draft of
// the project.
const withLiveDates = <Rec extends PlanRecord>(record: Rec): Rec =>
  "liveDates" in record && record.liveDates !== undefined
    ? { ...record, dates: record.liveDates }
    : record;

// Records as they are live, without drafts: those only drafted to be added are left out, and each
// field a draft changes has its live value back.
export function livePlanRecords<Rec extends PlanRecord>(
  records: readonly Rec[],
): Rec[] {
  return liveRecordsBy(records.map(withLiveDates), (_record, draft, rest) => ({
    ...rest,
    ...Object.fromEntries(
      Object.entries(draft.live as object).filter(([key]) =>
        draft.changed.includes(key),
      ),
    ),
  }));
}

type Kinds = "text" | "date" | "choice" | "link" | "flag";

// What each tab's records are called.
const recordWords: Readonly<
  Record<ProjectTab, { label: string; one: string; noun: string }>
> = {
  projects: { label: "Projects", one: "project", noun: "projects" },
  proposals: { label: "Proposals", one: "proposal", noun: "proposals" },
  customers: { label: "Customers", one: "customer", noun: "customers" },
  milestones: { label: "Milestones", one: "milestone", noun: "milestones" },
};

export const wordsOf = (tab: ProjectTab) =>
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
  draft: RecordDraft,
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
function planTable<Rec extends PlanRecord, Request>({
  type,
  label,
  one,
  noun,
  columns,
  request,
  menuItems,
  kinds,
  nameOf = (record) => (record as { name: string }).name,
}: {
  type: PlanRecordKind;
  label: string;
  one: string;
  noun: string;
  columns: (records: readonly Rec[]) => Column<Rec, PlanChange>[];
  request: (changes: PlanChange[]) => Request;
  menuItems: (record: Rec) => ReactNode;
  kinds?: readonly string[];
  nameOf?: (record: Rec) => string;
}): RecordTable<Rec, PlanChange, Request> {
  return {
    label,
    one,
    noun,
    ...(kinds === undefined ? {} : { kinds, kindOf: () => savedKind }),
    newRowLabel: () => `New ${one}`,
    removeLabel: () => `Remove ${one}`,
    nameOf,
    columnsFor: (_fields, _lists, _order, records) => columns(records),
    liveRecords: livePlanRecords,
    draftFields: (record, draft) => draftFieldsOf(columns([]), record, draft),
    recordProblem: () => undefined,
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
    ...projectDateColumns.map(([key, label]): Column<Project, PlanChange> => ({
      ...field<Project>(key, label, "date", { readOnly: true }),
      // The key is always one of the fixed dates.
      // eslint-disable-next-line security/detect-object-injection
      value: (project) => project.dates[key] ?? "",
      live: () => "",
      change: () => ({}),
    })),
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
      newRowValue: () => {
        const first = choices.statuses.find(({ retired }) => !retired);
        return first === undefined ? [] : [first.id];
      },
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

// The plan's tables have no columns that can be moved or edited.
const ignoreColumn = () => undefined;
export const noColumnActions = {
  moveColumn: ignoreColumn,
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
