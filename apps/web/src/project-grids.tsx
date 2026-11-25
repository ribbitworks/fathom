// SPDX-License-Identifier: Apache-2.0

// The Projects page's tables, customers, projects, proposals and milestones, each on the shared
// table.

import {
  type Customer,
  type CustomerRequest,
  type Milestone,
  planColumnNames,
  planIdNames,
  type Project,
  type ProjectRequest,
  projectLengths,
  type Proposal,
  type ProposalRequest,
} from "@fathom/shared";
import { Menu } from "@mantine/core";
import type { DraftField } from "./draft-details.tsx";
import { featureColumns } from "./feature-table.tsx";
import type {
  MilestoneAdding,
  PlanRecord,
  PlanRecordKind,
  TableChoices,
} from "./projects.ts";
import { isPending } from "./grid-drafts.ts";
import {
  customersColumn,
  draftFieldsOf,
  field,
  firstStatus,
  idColumn,
  identified,
  merged,
  nameColumn,
  namesCell,
  newKind,
  ownerColumn,
  pickedColumn,
  type PlanChange,
  planTable,
  recordMenu,
  savedKind,
  wordsOf,
} from "./plan-table.tsx";
import { RecordGrid } from "./record-grid.tsx";
import type {
  Column,
  ColumnGroup,
  RecordGridProps,
  RecordTable,
} from "./record-table.ts";

// A customer's columns in the headed groups its details show them in, as a feature's are.
export const customerColumnGroups: readonly ColumnGroup[] = [
  { title: "Details", keys: ["name", "description", "note"] },
];

const customerColumns = (): Column<Customer, PlanChange>[] => [
  nameColumn(),
  field<Customer>("description", planColumnNames.description, "text", {
    maxLength: projectLengths.customerDescription,
  }),
  field<Customer>("note", planColumnNames.note, "note"),
];

export function customerTable(
  onOpen?: (customer: Customer) => void,
): RecordTable<Customer, PlanChange, CustomerRequest> {
  return planTable<Customer, CustomerRequest>({
    type: "customer",
    ...wordsOf("customers"),
    columns: customerColumns,
    request: (changes) => merged(changes) as CustomerRequest,
    showDetails: onOpen,
  });
}

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
): Column<Project, PlanChange>[] {
  return [
    nameColumn(),
    idColumn<Project>(planIdNames.project),
    ownerColumn<Project>(choices.people),
    customersColumn<Project>(choices.customers, choices.drafted.projects),
    pickedColumn<Project>(
      "proposalIds",
      planColumnNames.proposalIds,
      choices.proposals,
      choices.drafted.projects,
    ),
    pickedColumn<Project>(
      "featureIds",
      planColumnNames.featureIds,
      choices.features,
      choices.drafted.projects,
    ),
    ...projectDateColumns.map(([key, label]) => projectDateColumn(key, label)),
  ];
}

// What a project's or proposal's menu opens: its details, and the features it names, on Features.
interface NamerMenu<Rec> {
  onOpen?: ((record: Rec) => void) | undefined;
  onFeatures?: ((record: Rec) => void) | undefined;
}

export function projectTable(
  choices: TableChoices,
  {
    onOpen,
    onMilestones,
    onFeatures,
  }: NamerMenu<Project> & { onMilestones?: (project: Project) => void } = {},
): RecordTable<Project, PlanChange, ProjectRequest> {
  return planTable<Project, ProjectRequest>({
    type: "project",
    ...wordsOf("projects"),
    columns: () => projectColumns(choices),
    request: (changes) => merged(changes) as ProjectRequest,
    showDetails: onOpen,
    menuItems: recordMenu<Project>([
      ["Show milestones", onMilestones],
      ["Show features", onFeatures],
    ]),
  });
}

export function proposalColumns(
  choices: TableChoices,
): Column<Proposal, PlanChange>[] {
  return [
    nameColumn(),
    idColumn<Proposal>(planIdNames.proposal),
    field<Proposal>("link", planColumnNames.link, "link"),
    ownerColumn<Proposal>(choices.people),
    customersColumn<Proposal>(choices.customers, choices.drafted.proposals),
    {
      ...field<Proposal>("statusId", planColumnNames.statusId, "choice", {
        required: true,
        choices: choices.statuses,
      }),
      // A new proposal starts in the first status offered.
      newRowValue: () => firstStatus(choices.statuses),
    },
    pickedColumn<Proposal>(
      "featureIds",
      planColumnNames.featureIds,
      choices.features,
      choices.drafted.proposals,
    ),
  ];
}

export function proposalTable(
  choices: TableChoices,
  { onOpen, onFeatures }: NamerMenu<Proposal> = {},
): RecordTable<Proposal, PlanChange, ProposalRequest> {
  return planTable<Proposal, ProposalRequest>({
    type: "proposal",
    ...wordsOf("proposals"),
    columns: () => proposalColumns(choices),
    request: (changes) => merged(changes) as ProposalRequest,
    showDetails: onOpen,
    menuItems: recordMenu<Proposal>([["Show features", onFeatures]]),
  });
}

export function milestoneColumns(
  projects: readonly Project[],
  filteredTo?: string,
): Column<Milestone, PlanChange>[] {
  return [
    field<Milestone>("name", planColumnNames.name, "text", {
      required: true,
      maxLength: projectLengths.name,
    }),
    {
      ...field<Milestone>("projectId", planColumnNames.projectId, "choice", {
        required: true,
        choices: identified(projects),
      }),
      content: ({ projectId }) => namesCell(projects)([projectId]),
      readOnlyOn: (kind) => kind === savedKind,
      ...(filteredTo === undefined ? {} : { newRowValue: () => [filteredTo] }),
    },
    field<Milestone>("date", planColumnNames.date, "date", { required: true }),
    field<Milestone>(
      "customerDelivery",
      planColumnNames.customerDelivery,
      "flag",
      {
        emptyLabel: "No",
      },
    ),
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
  customer: customerColumns,
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
  return draftFieldsOf(columns, record as never, record.draft as never);
}
