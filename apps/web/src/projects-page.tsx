// SPDX-License-Identifier: Apache-2.0

// The plan's records, each a table edited like People's: the Projects page, with its projects,
// proposals, customers, and milestones, a tab each, a record's details beside it, and a project's
// milestones there too; and the Features page, grouped by cycle. Every change is a draft, shown in
// place until an Approver approves it, from a record's menu or the Draft menu. Those who only see
// the plan see the same tables, read only. The tab, the table's view, and the record shown are kept
// in the page address.

import type {
  Asking,
  Customer,
  CustomerRequest,
  DraftKind,
  Feature,
  Milestone,
  MilestoneRequest,
  Project,
  ProjectPlan,
  ProjectRequest,
  Proposal,
  ProposalRequest,
  RecordRef,
  Show,
} from "@fathom/shared";
import {
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  Stack,
  Tabs,
  Text,
} from "@mantine/core";
import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
import {
  Fragment,
  type SubmitEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import { cellKinds } from "./cell-kinds.tsx";
import { DecisionModal } from "./decision-dialog.tsx";
import { DialogActions } from "./dialog-actions.tsx";
import {
  type Decision,
  decisionFor,
  draftSentAgain,
  noDrafts,
  pendingDraft,
  type DraftSelection,
} from "./drafts.ts";
import { Icon } from "./icons.tsx";
import { LoadProblem } from "./load-problem.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import details from "./record-details.module.css";
import {
  customerTable,
  dayOrEmpty,
  featureTable,
  livePlanRecords,
  milestoneColumns,
  milestoneTable,
  noColumnActions,
  noRecordProblem,
  type PlanChange,
  PlanGrid,
  projectColumns,
  projectDateColumn,
  projectDateColumns,
  projectTable,
  proposalColumns,
  proposalTable,
  wordsOf,
} from "./project-grids.tsx";
import {
  addMilestone,
  allMilestones,
  changeMilestone,
  type FeatureFields,
  type MilestoneAdding,
  operationsOf,
  listedPlanRecords,
  planChoicesQuery,
  planNodes,
  type PlanRecord,
  type PlanRecordKind,
  type PlanTab,
  projectPlanQuery,
  type ProjectTab,
  projectTabs,
  type TableChoices,
  tableChoices,
} from "./projects.ts";
import { RecordLink, Row } from "./record-details.tsx";
import {
  type Column,
  heldBack,
  newRecordProblems,
  pendingId,
  type RecordActions,
  type RecordTable,
} from "./record-grid.tsx";
import {
  type Editing,
  type RecordEditingContext,
  useRecordEditing,
} from "./record-editing.tsx";
import { useDiscardQuestion } from "./discard-question.tsx";
import { entered, type FormValues } from "./new-record-panel.tsx";
import {
  NewPlanRecordPanel,
  noOthers,
  PlanField,
} from "./new-plan-record-panel.tsx";
import { focusSoon } from "./focus.ts";
import { type RecordNode, recordNode } from "./record-drafts.ts";
import { RecordMenu } from "./record-menu.tsx";
import {
  discardRecordDraft,
  releaseStreamsQuery,
  resubmitRecordDraft,
} from "./releases.ts";
import { useSaving } from "./saving.ts";
import {
  type SidePanel,
  SidePanelFrame,
  sidePanelScroll,
  useNarrow,
} from "./side-panel.tsx";
import { DraftMark, HoldMarks } from "./status-mark.tsx";
import type { ChangeView } from "./table-controls.tsx";
import { type CellValue, formatDay, type View } from "./table-view.ts";

export const projectTabSchema = z.enum(projectTabs);

const listFormat = new Intl.ListFormat("en", { type: "conjunction" });

const newButtonId = "projects-new";
const panelId = "project-record-panel";
const panelTitleId = "project-record-panel-title";

// A record being added, as the table shows it before it is saved: a draft adding it.
function adding(kind: PlanRecordKind, id: string, request: object): PlanRecord {
  return {
    ...operationsOf(kind).blank,
    ...request,
    id,
    draft: { ...pendingDraft("created", {}), uses: [] },
  };
}

// The plan with a record of a kind changed, or taken out when the change gives none.
function withRecord(
  plan: ProjectPlan,
  kind: PlanRecordKind,
  id: string,
  change: (record: PlanRecord) => PlanRecord | undefined,
): ProjectPlan {
  const { all, withAll } = operationsOf(kind);
  return withAll(
    plan,
    all(plan).flatMap((record) => {
      if (record.id !== id) return [record];
      const next = change(record);
      return next === undefined ? [] : [next];
    }),
  );
}

function withAdded(
  plan: ProjectPlan,
  kind: PlanRecordKind,
  added: readonly PlanRecord[],
): ProjectPlan {
  const { all, withAll } = operationsOf(kind);
  return withAll(plan, [...all(plan), ...added]);
}

const removing = (record: PlanRecord): PlanRecord => ({
  ...record,
  draft: { ...pendingDraft("deleted", {}), uses: [] },
});

const discarded = (record: PlanRecord): PlanRecord | undefined =>
  record.draft?.action === "created"
    ? undefined
    : livePlanRecords([record]).at(0);

// What sets each of the plan's pages apart.
const planPages = {
  projects: {
    title: "Projects",
    tabbed: true,
    loadsStreams: false,
    mayEdit: (plan: ProjectPlan) => plan.canEdit,
  },
  features: {
    title: "Features",
    tabbed: false,
    loadsStreams: true,
    mayEdit: (plan: ProjectPlan) => plan.canEditFeatures,
  },
};

export function ProjectsPage({
  tab,
  onTab,
  approves = [],
  view,
  onView,
  open,
  onOpen,
  onMilestonesOf,
}: {
  tab: PlanTab;
  onTab?: (tab: ProjectTab, open?: string) => void;
  // The kinds of draft the user's role approves and rejects.
  approves?: readonly DraftKind[];
  view: View;
  onView: ChangeView;
  // The record whose details are shown beside the table, by its identifier.
  open?: string | undefined;
  onOpen?: (id: string | undefined) => void;
  // Shows the Milestones tab with only a project's milestones.
  onMilestonesOf?: (project: Project) => void;
}) {
  const page = planPages[tab === "features" ? "features" : "projects"];
  const query = useQuery(projectPlanQuery);
  const choicesQuery = useQuery(planChoicesQuery);
  const streamsQuery = useQuery({
    ...releaseStreamsQuery,
    enabled: page.loadsStreams,
  });
  const streamsPending = page.loadsStreams && streamsQuery.isPending;
  const choicesSettled = choicesQuery.isSuccess && !streamsPending;
  const narrow = useNarrow();
  const saving =
    useIsMutating({ mutationKey: [...projectPlanQuery.queryKey, "change"] }) >
    0;
  // What is being entered for a new record, on the tab it is being added to.
  const [beingAdded, setBeingAdded] = useState<{
    tab: PlanTab;
    values: FormValues;
    saving?: boolean;
  }>();
  // Each New starts a form afresh, with none of a discarded one's fields.
  const [forms, setForms] = useState(0);
  const form = beingAdded?.tab === tab ? beingAdded : undefined;
  // The record just added, whose details show once the plan has it.
  const [justAdded, setJustAdded] = useState<string>();
  const openedAdded = useRef<string>(undefined);
  const question = useDiscardQuestion();
  // Anything that would close the form asks first, while it holds something.
  const leave = (go: () => void) => {
    if (beingAdded?.saving === true) return;
    question.ask(
      beingAdded !== undefined && entered(beingAdded)
        ? {
            title: `Discard the ${wordsOf(beingAdded.tab).one} you're adding?`,
            keep: "Keep adding",
          }
        : undefined,
      () => {
        setBeingAdded(undefined);
        go();
      },
    );
  };
  useEffect(() => {
    if (
      justAdded === undefined ||
      query.data === undefined ||
      !listedPlanRecords(query.data).some(
        ({ record }) => record.id === justAdded,
      )
    ) {
      return;
    }
    if (openedAdded.current === justAdded) return;
    openedAdded.current = justAdded;
    onOpen?.(justAdded);
  }, [justAdded, query.data, onOpen]);
  useEffect(() => {
    if (open !== undefined) focusSoon(panelTitleId);
  }, [open]);
  const [decision, setDecision] = useState<Decision>();
  const [deciding, setDeciding] = useState(false);
  // A milestone being added to a project, or changed, in the project's panel.
  const [milestoneDialog, setMilestoneDialog] = useState<
    { project: Project; milestone?: Milestone } | undefined
  >();
  const [dialogOpened, setDialogOpened] = useState(false);
  const { save, undoable, done } = useSaving<ProjectPlan>({
    queryKey: projectPlanQuery.queryKey,
    removed: "Someone else has removed this. The plan has been refreshed.",
    blocked: deciding || dialogOpened,
  });
  const canEdit = query.data !== undefined && page.mayEdit(query.data);

  const decide = (asking: Asking, chosen: DraftSelection, naming?: boolean) => {
    const plan = query.data as ProjectPlan;
    setDecision(
      decisionFor(
        asking,
        chosen,
        approves,
        [],
        { fields: [], records: planNodes(plan) },
        naming,
      ),
    );
    setDeciding(true);
  };

  const discard = (type: PlanRecordKind, record: PlanRecord) => {
    const gone = record.draft?.action === "created";
    save({
      next: (plan) => withRecord(plan, type, record.id, discarded),
      save: () => discardRecordDraft({ type, id: record.id }),
      failure: `Fathom could not discard the draft of ${record.name}.`,
      onSaved: (changeSetId, before) => {
        if (gone) {
          done(
            `Discarded the draft adding ${record.name}.`,
            changeSetId,
            before,
          );
        } else {
          undoable(changeSetId, before);
        }
      },
    });
  };

  const resubmit = (type: PlanRecordKind, record: PlanRecord) => {
    save({
      next: (plan) => withRecord(plan, type, record.id, draftSentAgain),
      save: () => resubmitRecordDraft({ type, id: record.id }),
      failure: `Fathom could not send the draft of ${record.name} for approval again.`,
      onSaved: undoable,
    });
  };

  function actionsFor<Rec extends PlanRecord, Request>(
    type: PlanRecordKind,
  ): RecordActions<Rec, PlanChange, Request> {
    return {
      add: (added, onAdded, onFailed) => {
        save({
          next: (plan) =>
            withAdded(
              plan,
              type,
              added.map(({ id, request }) =>
                adding(type, id, request as object),
              ),
            ),
          save: async () => {
            const ids: string[] = [];
            // Every record of the kind before these were added, so each new one is told apart.
            const known = operationsOf(type)
              .all(query.data as ProjectPlan)
              .map(({ id }) => id);
            let changeSetId: string | null = null;
            // Each is its own request, one after another, so the change sets follow in order.
            for (const { request } of added) {
              const saved = await operationsOf(type).add(request);
              changeSetId = saved.changeSetId;
              ids.push(newestId(saved.plan, type, [...known, ...ids]));
            }
            onAdded(ids);
            return changeSetId;
          },
          failure: `Fathom could not add ${listFormat.format(
            added.map(({ request }) => (request as { name: string }).name),
          )}. Try again in a moment.`,
          onFailed,
          onSaved: undoable,
        });
      },
      update: (record, change) => {
        save({
          next: (plan) =>
            withRecord(plan, type, record.id, (shown) => ({
              ...shown,
              ...change,
            })),
          save: async () =>
            (await operationsOf(type).change(record, change)).changeSetId,
          failure: `Fathom could not change ${record.name}.`,
          onSaved: undoable,
        });
      },
      decide,
      remove: (record) => {
        save({
          next: (plan) => withRecord(plan, type, record.id, removing),
          save: () => operationsOf(type).remove(record),
          failure: `Fathom could not remove ${record.name}.`,
          onSaved: undoable,
        });
      },
      discard: (record) => {
        discard(type, record);
      },
      resubmit: (record) => {
        resubmit(type, record);
      },
      ...noColumnActions,
    };
  }

  let content: ReactNode;
  if (query.isPending || choicesQuery.isPending || streamsPending) {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (
    query.isError ||
    choicesQuery.isError ||
    (page.loadsStreams && streamsQuery.isError)
  ) {
    content = (
      <LoadProblem
        what={`the ${wordsOf(tab).noun}`}
        onRetry={() => {
          void query.refetch();
          void choicesQuery.refetch();
          if (page.loadsStreams) void streamsQuery.refetch();
        }}
      />
    );
  } else {
    const plan = query.data;
    const choices = tableChoices(
      plan,
      choicesQuery.data,
      streamsQuery.data?.streams ?? [],
    );
    const nodes = planNodes(plan);
    const openRecord = (record: { id: string }) => {
      leave(() => {
        onOpen?.(record.id);
      });
    };
    const showMilestonesOf = (project: Project) => {
      leave(() => {
        onMilestonesOf?.(project);
      });
    };
    const panel = recordPanel({
      tab,
      plan,
      choices,
      open,
      narrow,
      show: view.show,
      canEdit: canEdit && view.show !== "live",
      approves,
      nodes,
      onClose: () => {
        onOpen?.(undefined);
        focusSoon(`cell-${String(open)}-name`);
      },
      menu: {
        decide: (asking, ref) => {
          decide(asking, { ...noDrafts(), records: [ref] });
        },
        discard: (milestone) => {
          discard("milestone", milestone);
        },
        resubmit: (milestone) => {
          resubmit("milestone", milestone);
        },
        remove: actionsFor<Milestone, MilestoneAdding>("milestone").remove,
        edit: (project, milestone) => {
          setMilestoneDialog(
            milestone === undefined ? { project } : { project, milestone },
          );
          setDialogOpened(true);
        },
      },
      showMilestones: showMilestonesOf,
      showRecord: (next, id) => {
        onTab?.(next, id);
      },
      onChange: (type, record, change) => {
        actionsFor<PlanRecord, unknown>(type).update(record, change);
      },
    });
    const shared = { canEdit, approves, saving, view, onView };
    // The form takes the panel's place while a record is being added.
    function panelsWith<Rec extends PlanRecord, Request>(
      type: PlanRecordKind,
      table: RecordTable<Rec, PlanChange, Request>,
      records: readonly Rec[],
      actions: RecordActions<Rec, PlanChange, Request>,
    ): SidePanel[] {
      if (form === undefined) return panel === undefined ? [] : [panel];
      return [
        {
          key: "record",
          id: panelId,
          name: "details",
          node: (
            <NewPlanRecordPanel
              key={forms}
              title={`New ${wordsOf(tab).one}`}
              table={table}
              records={records}
              values={form.values}
              saving={form.saving === true}
              narrow={narrow}
              panelId={panelId}
              onValues={(values) => {
                setBeingAdded({ ...form, values });
              }}
              onAdd={(request) => {
                const pending = { ...form, saving: true };
                setBeingAdded(pending);
                actions.add(
                  [{ id: pendingId(), request }],
                  ([saved]) => {
                    setBeingAdded(undefined);
                    if (type === "milestone" || type === "feature") {
                      focusSoon(newButtonId);
                    } else setJustAdded(saved);
                  },
                  () => {
                    setBeingAdded({ ...pending, saving: false });
                  },
                );
              }}
              onCancel={() => {
                leave(() => {
                  focusSoon(newButtonId);
                });
              }}
            />
          ),
        },
      ];
    }
    const filteredTo = view.filters.projectId?.any?.at(0);
    const grids: Readonly<Record<PlanTab, () => ReactElement>> = {
      features: () => {
        const table = featureTable(choices);
        const actions = actionsFor<Feature, FeatureFields>("feature");
        return (
          <PlanGrid
            {...shared}
            panels={panelsWith("feature", table, plan.features, actions)}
            records={plan.features}
            table={table}
            actions={actions}
          />
        );
      },
      customers: () => {
        const table = customerTable(openRecord);
        const actions = actionsFor<Customer, CustomerRequest>("customer");
        return (
          <PlanGrid
            {...shared}
            panels={panelsWith("customer", table, plan.customers, actions)}
            records={plan.customers}
            table={table}
            actions={actions}
          />
        );
      },
      proposals: () => {
        const table = proposalTable(choices, openRecord);
        const actions = actionsFor<Proposal, ProposalRequest>("proposal");
        return (
          <PlanGrid
            {...shared}
            panels={panelsWith("proposal", table, plan.proposals, actions)}
            records={plan.proposals}
            table={table}
            actions={actions}
          />
        );
      },
      milestones: () => {
        const table = milestoneTable(plan.projects, filteredTo, (milestone) => {
          leave(() => {
            onTab?.("projects", milestone.projectId);
          });
        });
        const records = allMilestones(plan);
        const actions = actionsFor<Milestone, MilestoneAdding>("milestone");
        return (
          <PlanGrid
            {...shared}
            panels={panelsWith("milestone", table, records, actions)}
            records={records}
            table={table}
            actions={actions}
          />
        );
      },
      projects: () => {
        const table = projectTable(choices, openRecord, showMilestonesOf);
        const actions = actionsFor<Project, ProjectRequest>("project");
        return (
          <PlanGrid
            {...shared}
            panels={panelsWith("project", table, plan.projects, actions)}
            records={plan.projects}
            table={table}
            actions={actions}
          />
        );
      },
    };
    // The tab is always one of the fixed tabs.
    // eslint-disable-next-line security/detect-object-injection
    content = grids[tab]();
  }

  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader
        title={page.title}
        action={
          // The live records alone are read only.
          canEdit &&
          view.show !== "live" && (
            <Button
              id={newButtonId}
              variant="filled"
              disabled={!query.isSuccess || !choicesSettled}
              onClick={() => {
                leave(() => {
                  onOpen?.(undefined);
                  setForms((count) => count + 1);
                  setBeingAdded({ tab, values: {} });
                });
              }}
            >
              New {wordsOf(tab).one}
            </Button>
          )
        }
      />
      {page.tabbed && (
        <Tabs
          value={tab}
          onChange={(next) => {
            leave(() => {
              onTab?.(projectTabSchema.parse(next));
            });
          }}
        >
          <Tabs.List>
            {projectTabs.map((one) => (
              <Tabs.Tab key={one} value={one}>
                {wordsOf(one).label}
              </Tabs.Tab>
            ))}
          </Tabs.List>
        </Tabs>
      )}
      <Fragment key={tab}>{content}</Fragment>
      {question.dialog}
      <DecisionModal
        decision={decision}
        opened={deciding}
        onClose={() => {
          setDeciding(false);
        }}
        onDone={() => {
          setDeciding(false);
        }}
      />
      <Modal
        opened={dialogOpened}
        onClose={() => {
          setDialogOpened(false);
        }}
        title={
          milestoneDialog?.milestone === undefined
            ? "New milestone"
            : "Edit milestone"
        }
      >
        {milestoneDialog && (
          <MilestoneForm
            {...milestoneDialog}
            onCancel={() => {
              setDialogOpened(false);
            }}
            onSaved={(changeSetId) => {
              setDialogOpened(false);
              const before = query.data as ProjectPlan;
              save({
                next: (plan) => plan,
                save: () => Promise.resolve(changeSetId),
                failure: "",
                onSaved: () => {
                  undoable(changeSetId, before);
                },
              });
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}

// The identifier the server gave the record just added: the one of its kind not seen before.
const newestId = (
  plan: ProjectPlan,
  type: PlanRecordKind,
  taken: readonly string[],
) =>
  // The plan saved holds the record just added.
  (
    operationsOf(type)
      .all(plan)
      .find(({ id }) => !taken.includes(id)) as PlanRecord
  ).id;

// The kind of a record in a table of one kind.
const onlyKind = "";

const milestoneFields = milestoneColumns([]).filter(
  ({ key }) => key !== "projectId",
);

// A milestone's name, date, and whether it is a delivery to customers, added to a project or
// changed, saved as a draft.
function MilestoneForm({
  project,
  milestone,
  onCancel,
  onSaved,
}: {
  project: Project;
  milestone?: Milestone | undefined;
  onCancel: () => void;
  onSaved: (changeSetId: string | null) => void;
}) {
  const [values, setValues] = useState<Record<string, CellValue>>(() =>
    Object.fromEntries(
      milestoneFields.map((column) => [
        column.key,
        milestone === undefined
          ? cellKinds[column.kind].empty
          : column.value(milestone),
      ]),
    ),
  );
  const [submitted, setSubmitted] = useState(false);
  const mutation = useMutation({
    mutationFn: async (request: MilestoneRequest) =>
      (milestone === undefined
        ? await addMilestone(project.id, request)
        : await changeMilestone(milestone, request)
      ).changeSetId,
    onSuccess: onSaved,
  });
  const problems = newRecordProblems(
    milestoneFields,
    onlyKind,
    values,
    noRecordProblem,
    noOthers,
  );
  const submit = (event: SubmitEvent) => {
    event.preventDefault();
    setSubmitted(true);
    if (problems.length > 0) return;
    mutation.mutate({
      name: values.name as string,
      date: values.date as string,
      customerDelivery: (values.customerDelivery as string[]).length > 0,
    });
  };
  return (
    <form onSubmit={submit} noValidate>
      <Stack gap="md">
        {milestoneFields.map((column) => (
          <PlanField
            key={column.key}
            column={column}
            value={values[column.key] as CellValue}
            problem={
              submitted
                ? problems.find((one) => one.column === column.key)?.message
                : undefined
            }
            firstInDialog={column.key === "name"}
            onChange={(value) => {
              setValues({ ...values, [column.key]: value });
            }}
          />
        ))}
        <DialogActions
          error={mutation.error}
          pending={mutation.isPending}
          label={milestone === undefined ? "Add milestone" : "Save"}
          onCancel={onCancel}
        />
      </Stack>
    </form>
  );
}

interface MilestoneMenu {
  decide: (asking: Asking, ref: RecordRef) => void;
  discard: (milestone: Milestone) => void;
  resubmit: (milestone: Milestone) => void;
  remove: (milestone: Milestone) => void;
  edit: (project: Project, milestone?: Milestone) => void;
}

// The details of the record open beside the table, as the tab's table shows them, each value a
// draft changes with its live value under it, and a project's dates and milestones.
function recordPanel({
  tab,
  plan,
  choices,
  open,
  narrow,
  show,
  canEdit,
  approves,
  nodes,
  onClose,
  menu,
  showMilestones,
  showRecord,
  onChange,
}: {
  tab: PlanTab;
  plan: ProjectPlan;
  choices: TableChoices;
  open: string | undefined;
  narrow: boolean;
  show: Show;
  canEdit: boolean;
  approves: readonly DraftKind[];
  nodes: readonly RecordNode[];
  onClose: () => void;
  menu: MilestoneMenu;
  showMilestones: (project: Project) => void;
  showRecord: (tab: ProjectTab, id: string) => void;
  onChange: (
    type: PlanRecordKind,
    record: PlanRecord,
    change: PlanChange,
  ) => void;
}): SidePanel | undefined {
  if (open === undefined) return undefined;
  const asShown = <Rec extends PlanRecord>(records: readonly Rec[]) =>
    show === "live" ? livePlanRecords(records) : records;
  const projects = asShown(plan.projects);
  const shownOnTab: Readonly<
    Record<
      PlanTab,
      | {
          type: PlanRecordKind;
          record: PlanRecord | undefined;
          columns: readonly Column<never, PlanChange>[];
        }
      | undefined
    >
  > = {
    projects: {
      type: "project",
      record: projects.find(({ id }) => id === open),
      columns: projectColumns(choices).filter(
        ({ key }) => !projectDateColumns.some(([date]) => date === key),
      ),
    },
    proposals: {
      type: "proposal",
      record: asShown(plan.proposals).find(({ id }) => id === open),
      columns: proposalColumns(choices),
    },
    customers: {
      type: "customer",
      record: asShown(plan.customers).find(({ id }) => id === open),
      columns: customerTable().columnsFor([], [], [], []),
    },
    milestones: undefined,
    features: undefined,
  };
  // The tab is always one of the fixed tabs.
  // eslint-disable-next-line security/detect-object-injection
  const onTab = shownOnTab[tab];
  const record = onTab?.record;
  const project = projects.find(({ id }) => id === open);
  const extra =
    tab === "projects" && project !== undefined ? (
      <ProjectExtras
        project={project}
        show={show}
        canEdit={canEdit}
        approves={approves}
        nodes={nodes}
        menu={menu}
        showMilestones={showMilestones}
      />
    ) : null;
  if (onTab === undefined || record === undefined) return undefined;
  const shown = record;
  const { type, columns } = onTab;
  return {
    key: "record",
    id: panelId,
    name: "details",
    node: (
      <SidePanelFrame
        id={panelId}
        titleId={panelTitleId}
        narrow={narrow}
        title={
          <Group gap="xs" wrap="nowrap">
            <span>{shown.name}</span>
            {shown.draft && <DraftMark draft={shown.draft} />}
            <HoldMarks unpublished={false} heldBy={shown.heldBy} />
          </Group>
        }
        close={{ label: "Close details", onClose }}
      >
        <Stack gap="lg" className={sidePanelScroll}>
          <PlanRecordDetails
            columns={columns}
            record={shown}
            beside={show === "both"}
            canEdit={canEdit}
            showRecord={showRecord}
            onChange={(change) => {
              onChange(type, shown, change);
            }}
          />
          {extra}
        </Stack>
      </SidePanelFrame>
    ),
  };
}

// The tab whose records a column's values name, for those that can be followed.
const linkedTabs = new Map<string, ProjectTab>([
  ["customerIds", "customers"],
  ["proposalIds", "proposals"],
]);

function RecordLinks({
  column,
  ids,
  onShow,
}: {
  column: Column<never, PlanChange>;
  ids: readonly string[];
  onShow: (id: string) => void;
}) {
  const named = ids.flatMap((id) => {
    const choice = column.choices.find((one) => one.id === id);
    return choice === undefined ? [] : [choice];
  });
  return (
    <Group gap={4}>
      {named.map(({ id, label }, index) => (
        <span key={id}>
          <RecordLink
            name={label}
            onShow={() => {
              onShow(id);
            }}
          />
          {index < named.length - 1 && ","}
        </span>
      ))}
    </Group>
  );
}

// A record's values, as its table shows them, each changed in place as in its cell by those who may.
function PlanRecordDetails({
  columns,
  record,
  beside,
  canEdit,
  showRecord,
  onChange,
}: {
  columns: readonly Column<never, PlanChange>[];
  record: PlanRecord;
  beside: boolean;
  canEdit: boolean;
  showRecord: (tab: ProjectTab, id: string) => void;
  onChange: (change: PlanChange) => void;
}) {
  const { closeStale, editingOf } = useRecordEditing<never, PlanChange>();
  const values = Object.fromEntries(
    columns.map((column) => [column.key, column.value(record as never)]),
  );
  const context: RecordEditingContext<never, PlanChange> = {
    id: record.id,
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
  };
  closeStale(context);
  const editing = editingOf(context);
  return (
    <dl className={details.list}>
      {columns.map((column) => (
        <DetailRow
          key={column.key}
          column={column}
          record={record}
          value={values[column.key] as CellValue}
          beside={beside}
          editing={editing(column)}
          showRecord={showRecord}
        />
      ))}
    </dl>
  );
}

function DetailRow({
  column,
  record,
  value,
  beside,
  editing,
  showRecord,
}: {
  column: Column<never, PlanChange>;
  record: PlanRecord;
  value: CellValue;
  beside: boolean;
  editing: Editing | undefined;
  showRecord: (tab: ProjectTab, id: string) => void;
}) {
  const draft = record.draft;
  const changed =
    beside && draft?.action === "changed" && draft.changed.includes(column.key);
  const linkedTab = linkedTabs.get(column.key);
  return (
    <Row
      column={column}
      value={value}
      changed={changed ? { live: column.live(draft as never) } : undefined}
      editing={editing}
    >
      {linkedTab !== undefined && Array.isArray(value) && value.length > 0 ? (
        <RecordLinks
          column={column}
          ids={value}
          onShow={(id) => {
            showRecord(linkedTab, id);
          }}
        />
      ) : undefined}
    </Row>
  );
}

// A project's dates, from its milestones, with the live ones under any its milestones' drafts
// change, and its milestones, each with its menu.
function ProjectExtras({
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
  const milestones =
    show === "live" ? livePlanRecords(project.milestones) : project.milestones;
  return (
    <>
      <dl className={details.list}>
        {projectDateColumns.map(([key, label]) => {
          const column = projectDateColumn(key, label);
          const live =
            show === "both" && project.draft?.action !== "created"
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
            No milestones yet
          </Text>
        )}
        <Stack gap={0}>
          {milestones.map((milestone) => (
            <div
              key={milestone.id}
              className={[details.row, details.itemRow].join(" ")}
            >
              <div>
                <Group gap="xs" wrap="nowrap">
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
                  {milestone.draft && <DraftMark draft={milestone.draft} />}
                  <HoldMarks unpublished={false} heldBy={milestone.heldBy} />
                </Group>
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
