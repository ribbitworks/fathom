// SPDX-License-Identifier: Apache-2.0

// The Projects page's tables, customers, projects, proposals and milestones, each on the shared
// table.

import { activitiesColumn } from "./activity-list.tsx";
import { activityColumns } from "./activity-table.tsx";
import {
  type Activity,
  type Customer,
  customerFeatures,
  customerKeptBy,
  projectKeptBy,
  proposalKeptBy,
  type CustomerRequest,
  type Feature,
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
import {
  type MilestoneAdding,
  type PlanRecord,
  type PlanRecordKind,
  type TableChoices,
} from "./projects.ts";
import { isPending } from "./grid-drafts.ts";
import {
  customersColumn,
  draftFieldsOf,
  field,
  firstStatus,
  idColumn,
  merged,
  nameColumn,
  namersColumn,
  newKind,
  ownerColumn,
  pickedColumn,
  type PlanChange,
  planTable,
  projectColumn,
  recordMenu,
  removeTurnedOffBy,
  savedKind,
  wordsOf,
  workedOutColumn,
} from "./plan-table.tsx";
import { RecordGrid } from "./record-grid.tsx";
import { ShowOnItem } from "./record-details.tsx";
import {
  type Column,
  type ColumnGroup,
  inGroupOrder,
  type RecordGridProps,
  type RecordTable,
  type ShowOn,
} from "./record-table.ts";

// A customer's columns in the headed groups its details show them in, as a feature's are.
export const customerColumnGroups: readonly ColumnGroup[] = [
  { title: "Details", keys: ["name", "description", "note"] },
  { title: "Commitments", keys: ["projectIds", "proposalIds", "featureIds"] },
];

export const customerOwnColumns = (): Column<Customer, PlanChange>[] => [
  nameColumn(),
  field<Customer>("description", planColumnNames.description, "text", {
    maxLength: projectLengths.customerDescription,
  }),
  field<Customer>("note", planColumnNames.note, "note"),
];

// The plan's records as a customer's columns read them.
type CustomerChoices = Pick<
  TableChoices,
  "projects" | "proposals" | "features" | "drafted"
>;

// The features each customer gets, worked out once for each customer while the table's columns
// last, since sorting reads each cell many times.
function customerFeaturesOf(choices: CustomerChoices) {
  const worked = new Map<string, readonly Feature[]>();
  return (customer: Customer) => {
    const known = worked.get(customer.id);
    if (known !== undefined) return known;
    const gets = customerFeatures(choices, customer.id);
    worked.set(customer.id, gets);
    return gets;
  };
}

// A customer's columns: its own, then the projects and proposals naming it, each marked with its own
// draft, and the features it gets, worked out from their links, in its details' order. Features
// shows only to those who see features.
export function customerColumns(
  choices: CustomerChoices,
  seesFeatures: boolean,
): Column<Customer, PlanChange>[] {
  const featuresOf = customerFeaturesOf(choices);
  return inGroupOrder(
    [
      ...customerOwnColumns(),
      {
        ...namersColumn<Customer>(
          "projectIds",
          planColumnNames.projectIds,
          choices.projects,
          choices.drafted.projects,
          "customerIds",
        ),
        readOnly: true,
      },
      {
        ...namersColumn<Customer>(
          "proposalIds",
          planColumnNames.proposalIds,
          choices.proposals,
          choices.drafted.proposals,
          "customerIds",
        ),
        readOnly: true,
      },
      ...(seesFeatures
        ? [
            workedOutColumn<Customer>(
              "featureIds",
              planColumnNames.featureIds,
              choices.features,
              featuresOf,
            ),
          ]
        : []),
    ],
    customerColumnGroups,
  );
}

export function customerTable(
  choices: CustomerChoices,
  {
    seesFeatures,
    onOpen,
    onFeatures,
  }: {
    seesFeatures: boolean;
    onOpen?: ((customer: Customer) => void) | undefined;
    // Opens Features with every feature the customer gets or asks for.
    onFeatures?: ((customer: Customer) => void) | undefined;
  },
): RecordTable<Customer, PlanChange, CustomerRequest> {
  return planTable<Customer, CustomerRequest>({
    type: "customer",
    ...wordsOf("customers"),
    columns: () => customerColumns(choices, seesFeatures),
    request: (changes) => merged(changes) as CustomerRequest,
    showDetails: onOpen,
    menuItems: recordMenu<Customer>([["Show all features", onFeatures]]),
    removeTurnedOff: (customer) =>
      removeTurnedOffBy(customerKeptBy(choices, customer.id), "customer"),
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
    ...projectActivitiesColumn(choices.activities),
    ...projectDateColumns.map(([key, label]) => projectDateColumn(key, label)),
  ];
}

// A project's activities, for a role that sees them.
const projectActivitiesColumn = (
  activities: readonly Activity[] | undefined,
): Column<Project, PlanChange>[] =>
  activities === undefined
    ? []
    : [
        activitiesColumn<Project, PlanChange>(
          activities,
          "projectId",
          ({ id }) => id,
        ),
      ];

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
    showOn,
  }: NamerMenu<Project> & {
    onMilestones?: (project: Project) => void;
    // Where the project's activities show, for a role that sees them.
    showOn?: ((project: Project) => ShowOn | undefined) | undefined;
  } = {},
): RecordTable<Project, PlanChange, ProjectRequest> {
  const listed = recordMenu<Project>([
    ["Show on Milestones", onMilestones],
    ["Show on Features", onFeatures],
  ]);
  return planTable<Project, ProjectRequest>({
    type: "project",
    ...wordsOf("projects"),
    columns: () => projectColumns(choices),
    request: (changes) => merged(changes) as ProjectRequest,
    showDetails: onOpen,
    removeTurnedOff: (project) =>
      removeTurnedOffBy(
        projectKeptBy({ activities: choices.activities ?? [] }, project.id),
        "project",
      ),
    menuItems: (project) =>
      !isPending(project) && (
        <>
          {listed(project)}
          <ShowOnItem showOn={showOn?.(project)} />
        </>
      ),
  });
}

// Where a proposal's features show: on Features, filtered to it, while it names any, where the
// page can show them.
const featuresShowOn = (
  onFeatures: ((proposal: Proposal) => void) | undefined,
  proposal: Proposal,
): ShowOn | undefined =>
  onFeatures === undefined || proposal.featureIds.length === 0
    ? undefined
    : {
        page: "Features",
        onShow: () => {
          onFeatures(proposal);
        },
      };

// A proposal's columns; its Features shows on Features, filtered to it, while it names any.
export function proposalColumns(
  choices: TableChoices,
  onFeatures?: (proposal: Proposal) => void,
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
    {
      ...pickedColumn<Proposal>(
        "featureIds",
        planColumnNames.featureIds,
        choices.features,
        choices.drafted.proposals,
      ),
      chooseWords: "Choose features",
      showOn: (proposal: Proposal) => featuresShowOn(onFeatures, proposal),
    },
  ];
}

export function proposalTable(
  choices: TableChoices,
  { onOpen, onFeatures }: NamerMenu<Proposal> = {},
): RecordTable<Proposal, PlanChange, ProposalRequest> {
  return planTable<Proposal, ProposalRequest>({
    type: "proposal",
    ...wordsOf("proposals"),
    columns: () => proposalColumns(choices, onFeatures),
    request: (changes) => merged(changes) as ProposalRequest,
    showDetails: onOpen,
    removeTurnedOff: (proposal) =>
      removeTurnedOffBy(proposalKeptBy(choices, proposal.id), "proposal"),
    menuItems: (proposal) =>
      !isPending(proposal) && (
        <ShowOnItem showOn={featuresShowOn(onFeatures, proposal)} />
      ),
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
      ...projectColumn<Milestone>(projects, { required: true }),
      readOnlyOn: (kind) => kind === savedKind,
      ...(filteredTo === undefined ? {} : { newRowValue: () => [filteredTo] }),
    },
    field<Milestone>("date", planColumnNames.date, "date", { required: true }),
    field<Milestone>(
      "customerDelivery",
      planColumnNames.customerDelivery,
      "flag",
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
  customer: customerOwnColumns,
  project: projectColumns,
  proposal: proposalColumns,
  milestone: (choices) => milestoneColumns(choices.projects),
  feature: (choices) => featureColumns(choices),
  activity: (choices) => activityColumns(choices),
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
