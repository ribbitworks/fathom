// SPDX-License-Identifier: Apache-2.0

// The plan's records, each a table edited like People's: the Projects page, with a tab each for
// projects, proposals, customers and milestones, and the Features page, as a table or a board.

import type {
  Customer,
  DraftKind,
  Feature,
  Milestone,
  Project,
  ProjectPlan,
} from "@fathom/shared";
import { cardPartSchema, type PlanMode } from "@fathom/shared";
import { Loader, Modal, Stack } from "@mantine/core";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { customerFilter } from "./customer-filter.ts";
import { effortConversionsQuery } from "./effort.ts";
import { type BoardPlace, FeatureBoard } from "./feature-board-view.tsx";
import { focusCard } from "./feature-card.tsx";
import {
  boardParts,
  finishedChoice,
  finishedOnBoard,
  finishedWords,
} from "./feature-board.ts";
import { hiddenUnlessShown } from "./view-choices.ts";
import { today } from "./today.ts";
import { TableTips } from "./table-tips.tsx";
import {
  Fragment,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import {
  columnDraftActions,
  columnRemover,
  ColumnModal,
  useColumnDialog,
} from "./column-editing.tsx";
import { DecisionModal } from "./decision-dialog.tsx";
import { noDrafts } from "./drafts.ts";
import { type Decision } from "./draft-decisions.ts";
import { listsQuery } from "./lists.ts";
import { LoadProblem } from "./load-problem.tsx";
import { HeadingTabPanel } from "./page-header.tsx";
import classes from "./pages.module.css";
import { featureTable } from "./feature-table.tsx";
import { livePlanRecords, type PlanChange, wordsOf } from "./plan-table.tsx";
import {
  customerTable,
  milestoneTable,
  PlanGrid,
  projectTable,
  proposalTable,
} from "./project-grids.tsx";
import {
  allMilestones,
  type FeatureFields,
  type FeatureNamer,
  type MilestoneAdding,
  listedPlanRecords,
  planChoicesQuery,
  planNodes,
  type PlanRecord,
  type PlanRecordKind,
  type PlanTab,
  projectPlanQuery,
  projectTabs,
  tableChoices,
} from "./projects.ts";
import { withFeatureColumns } from "./plan-record-changes.ts";
import {
  detailTabs,
  MilestoneForm,
  panelId,
  panelTitleId,
  recordPanel,
} from "./plan-record-panel.tsx";
import { pendingId } from "./grid-drafts.ts";
import {
  newButtonId,
  newColumnId,
  PlanPageHeading,
  tabsId,
} from "./plan-page-heading.tsx";
import { planRecordActions } from "./plan-record-actions.ts";
import { focusRecordCell } from "./grid-row.tsx";
import { recordsAsShown } from "./live-records.ts";
import { RecordGrid } from "./record-grid.tsx";
import type {
  LinkedColumn,
  RecordActions,
  RecordTable,
} from "./record-table.ts";
import { newRecordQuestion, useDiscardQuestion } from "./discard-question.tsx";
import { entered, type FormValues, newRecordId } from "./new-record-panel.tsx";
import { afterNote, noteQuestion, useNoteEditing } from "./note-editing.tsx";
import { NewPlanRecordPanel } from "./new-plan-record-panel.tsx";
import { focusSoon } from "./focus.ts";
import { addingTo, useAddFromPanel } from "./add-from-panel.tsx";
import { releaseStreamsQuery } from "./releases.ts";
import { useSavedViews } from "./saved-views.tsx";
import { useSaving } from "./saving.ts";
import { type SidePanel, useNarrow } from "./side-panel.tsx";
import type { ChangeView } from "./table-controls.tsx";
import type { View } from "./table-view.ts";

export const projectTabSchema = z.enum(projectTabs);

// What sets each of the plan's pages apart.
const planPages = {
  projects: {
    title: "Projects",
    tabbed: true,
    loadsStreams: false,
    loadsEffort: false,
    mayEdit: (plan: ProjectPlan) => plan.canEdit,
  },
  features: {
    title: "Features",
    tabbed: false,
    loadsStreams: true,
    loadsEffort: true,
    mayEdit: (plan: ProjectPlan) => plan.canEditFeatures,
  },
};

export function ProjectsPage({
  tab,
  onTab,
  approves = [],
  canEditColumns = false,
  editsFeatureTeams = false,
  view,
  onView,
  applied,
  onApply,
  canShareViews = false,
  open,
  onOpen,
  onMilestonesOf,
  onFeaturesOf,
  onCustomerFeatures,
  seesFeatures = true,
  onReleaseStream,
  board,
  linkedColumn,
}: {
  // An added column on Features a link opens, whose menu the table opens with open.
  linkedColumn?: LinkedColumn | undefined;
  tab: PlanTab;
  // Shows another of the plan's pages or tabs, with a record's details open if one is named.
  onTab?: (tab: PlanTab, open?: string) => void;
  // The kinds of draft the user's role approves and rejects.
  approves?: readonly DraftKind[];
  // Whether the user may add and change the columns on Features.
  canEditColumns?: boolean;
  // Whether the user may set a feature's feature team.
  editsFeatureTeams?: boolean;
  view: View;
  onView: ChangeView;
  // The saved view the view started from, as the address names it.
  applied: string | undefined;
  onApply: (view: View, id: string, replace?: boolean) => void;
  canShareViews?: boolean;
  // The record whose details are shown beside the table, by its identifier.
  open?: string | undefined;
  onOpen?: (id: string | undefined) => void;
  // Shows the Milestones tab with only a project's milestones.
  onMilestonesOf?: (project: Project) => void;
  // Shows Features with only those a project or proposal names.
  onFeaturesOf?: (namer: FeatureNamer) => void;
  // Shows Features with every feature a customer gets or asks for.
  onCustomerFeatures?: (customer: Customer) => void;
  // Whether the reader sees features, without which Customers has no Features column.
  seesFeatures?: boolean;
  // Shows a release stream on Releases, with its releases and cycles.
  onReleaseStream?: (streamId: string) => void;
  // How Features shows its features, as a table or a board, and where the board is.
  board?: {
    mode: PlanMode | undefined;
    onMode: (mode: PlanMode) => void;
    place: BoardPlace;
    onPlace: (place: BoardPlace) => void;
  };
}) {
  const page = planPages[tab === "features" ? "features" : "projects"];
  const query = useQuery(projectPlanQuery);
  const choicesQuery = useQuery(planChoicesQuery);
  const streamsQuery = useQuery({
    ...releaseStreamsQuery,
    enabled: page.loadsStreams,
  });
  const effortQuery = useQuery({
    ...effortConversionsQuery,
    enabled: page.loadsEffort,
  });
  const mode = board?.mode ?? "table";
  const onBoard = tab === "features" && mode === "board";
  const [now] = useState(today);
  const settingsPending =
    (page.loadsStreams && streamsQuery.isPending) ||
    (page.loadsEffort && effortQuery.isPending);
  const editsFeatureColumns = tab === "features" && canEditColumns;
  // Every list a new column could draw on; the plan holds only those columns already do.
  const listsToOffer = useQuery({
    ...listsQuery,
    enabled: editsFeatureColumns,
  });
  const columnDialog = useColumnDialog();
  const choicesSettled = choicesQuery.isSuccess && !settingsPending;
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
  const notes = useNoteEditing(panelTitleId);
  const note = notes.note(form === undefined ? open : newRecordId);
  // The record just added, whose details show once the plan has it.
  const [justAdded, setJustAdded] = useState<string>();
  const openedAdded = useRef<string>(undefined);
  const question = useDiscardQuestion();
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
  const [decision, setDecision] = useState<Decision>();
  const [deciding, setDeciding] = useState(false);
  // A milestone being added to a project, or changed, in the project's panel.
  const [milestoneDialog, setMilestoneDialog] = useState<
    { project: Project; milestone?: Milestone } | undefined
  >();
  const [dialogOpened, setDialogOpened] = useState(false);
  // Each tab, and Features, keeps saved views of its own.
  const views = useSavedViews({
    table: tab,
    within: projectPlanQuery.queryKey,
    view,
    applied,
    mode: board?.mode,
    onApply,
    canShare: canShareViews,
    blocked: deciding || dialogOpened || columnDialog.opened,
  });
  const changes = useSaving<ProjectPlan>({
    queryKey: projectPlanQuery.queryKey,
    removed: "Someone else has removed this. The plan has been refreshed.",
    blocked: deciding || dialogOpened || columnDialog.opened || views.opened,
  });
  const { shown, undoable } = changes;
  const canEdit = query.data !== undefined && page.mayEdit(query.data);

  const { decide, discard, changeReason, resubmit, actionsFor } =
    planRecordActions({
      changes,
      plan: query.data,
      approves,
      onDecision: (decision) => {
        setDecision(decision);
        setDeciding(true);
      },
    });

  const linked = useAddFromPanel({
    canAdd:
      query.data !== undefined && query.data.canEdit && form === undefined,
    actionsFor,
  });
  // Anything that would close a form asks first, while it holds something.
  const leave = (go: () => void) => {
    if (beingAdded?.saving === true || linked.saving) return;
    question.ask(
      beingAdded !== undefined && entered(beingAdded)
        ? newRecordQuestion(wordsOf(beingAdded.tab).one)
        : (linked.question ?? (notes.changing ? noteQuestion : undefined)),
      () => {
        notes.discard();
        setBeingAdded(undefined);
        linked.close();
        go();
      },
    );
  };
  const { addsFor } = linked;

  let content: ReactNode;
  if (query.isPending || choicesQuery.isPending || settingsPending) {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (
    query.isError ||
    choicesQuery.isError ||
    (page.loadsStreams && streamsQuery.isError) ||
    (page.loadsEffort && effortQuery.isError) ||
    listsToOffer.isError
  ) {
    content = (
      <LoadProblem
        what={`the ${wordsOf(tab).noun}`}
        onRetry={() => {
          void query.refetch();
          void choicesQuery.refetch();
          if (page.loadsStreams) void streamsQuery.refetch();
          if (page.loadsEffort) void effortQuery.refetch();
          if (editsFeatureColumns) void listsToOffer.refetch();
        }}
      />
    );
  } else {
    const plan = query.data;
    // The release streams, which only Features loads.
    const streams = streamsQuery.data?.streams ?? [];
    const asShown = <Rec extends PlanRecord>(records: readonly Rec[]) =>
      recordsAsShown(view.show, records, livePlanRecords);
    // Projects and proposals as the view shows them, so the features they name follow the view.
    const choices = {
      ...tableChoices(plan, choicesQuery.data, streams, effortQuery.data),
      projects: asShown(plan.projects),
      proposals: asShown(plan.proposals),
    };
    // The records a customer's features are worked out from, as the view shows them. Every
    // customer follows those shown, so the pill still names one the Draft menu leaves out.
    const customerLinks = {
      customers: [...asShown(plan.customers), ...plan.customers],
      projects: choices.projects,
      proposals: choices.proposals,
      features: asShown(plan.features),
      drafted: choices.drafted,
    };
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
    const showFeaturesOf =
      (type: FeatureNamer["type"]) => (record: { id: string }) => {
        leave(() => {
          onFeaturesOf?.({ type, id: record.id });
        });
      };
    const showCustomerFeatures = (customer: Customer) => {
      leave(() => {
        onCustomerFeatures?.(customer);
      });
    };
    const panel = recordPanel({
      tab,
      plan,
      choices,
      open,
      narrow,
      show: view.show,
      units: view,
      editsKind: (type) =>
        view.show !== "live" &&
        (type === "feature" ? plan.canEditFeatures : plan.canEdit),
      editsFeatureTeams,
      approves,
      seesFeatures,
      nodes,
      onClose: () => {
        leave(() => {
          onOpen?.(undefined);
          if (onBoard) focusCard(String(open));
          else focusRecordCell(String(open), "name");
        });
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
      follow: {
        showRecord: (next, id) => {
          // The tab is always one of the fixed tabs.
          // eslint-disable-next-line security/detect-object-injection
          if (detailTabs[tab].some((one) => one === next)) {
            openRecord({ id });
          } else onTab?.(next, id);
        },
        showStream: (streamId) => {
          onReleaseStream?.(streamId);
        },
      },
      onChange: (type, record, change) => {
        actionsFor<PlanRecord, unknown>(type).update(record, change);
      },
      changeReason,
      notes,
      adds: addsFor,
    });
    const shared = {
      canEdit,
      approves,
      saving,
      view,
      onView,
      saved: views.saved,
      selected: open,
    };
    // The form takes the panel's place while a record is being added.
    function panelsWith<Rec extends PlanRecord, Request>(
      type: PlanRecordKind,
      table: RecordTable<Rec, PlanChange, Request>,
      records: readonly Rec[],
      actions: RecordActions<Rec, PlanChange, Request>,
    ): SidePanel[] {
      const writing = note === undefined ? [] : [note];
      if (form === undefined) {
        const adding = linked.panel({
          plan,
          choices,
          featureEdits: { editsCommitments: plan.canEdit, editsFeatureTeams },
          narrow,
          notes,
          units: view.units,
          ask: question.ask,
        });
        return [
          ...(panel === undefined ? [] : [panel]),
          ...(adding === undefined ? [] : [adding]),
          ...writing,
        ];
      }
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
              {...(type === "feature" ? { added: plan.featureColumns } : {})}
              notes={notes}
              units={view.units}
              onValue={(key, value) => {
                setBeingAdded(
                  (current) =>
                    current && {
                      ...current,
                      values: { ...current.values, [key]: value },
                    },
                );
              }}
              onAdd={(request, refused) => {
                afterNote(notes, question.ask, () => {
                  const pending = { ...form, saving: true };
                  setBeingAdded(pending);
                  actions.add(
                    [{ id: pendingId(), request }],
                    ([saved]) => {
                      setBeingAdded(undefined);
                      if (type === "milestone") {
                        focusSoon(newButtonId);
                      } else setJustAdded(saved);
                    },
                    () => {
                      setBeingAdded({ ...pending, saving: false });
                    },
                    refused,
                  );
                });
              }}
              onCancel={() => {
                leave(() => {
                  focusSoon(newButtonId);
                });
              }}
            />
          ),
        },
        ...writing,
      ];
    }
    function gridOf<Rec extends PlanRecord, Request>(
      type: PlanRecordKind,
      table: RecordTable<Rec, PlanChange, Request>,
      records: Rec[],
    ): ReactElement {
      const actions = actionsFor<Rec, Request>(type);
      const adding = addingTo(table, addsFor(type));
      return (
        <TableTips>
          <PlanGrid
            {...shared}
            panels={panelsWith(type, table, records, actions)}
            records={records}
            table={adding}
            actions={actions}
          />
        </TableTips>
      );
    }
    const filteredTo = view.filters.projectId?.any?.at(0);
    const grids: Readonly<Record<PlanTab, () => ReactElement>> = {
      features: () => {
        const table = addingTo(
          featureTable(choices, {
            onOpen: openRecord,
            editsCommitments: plan.canEdit,
            editsFeatureTeams,
            board: onBoard,
          }),
          addsFor("feature"),
        );
        const offeredParts = cardPartSchema.options;
        // The Board leaves out done and cancelled features unless its view shows them, each by its
        // status as the Draft view shows it; the table shows every feature.
        const live =
          view.show === "live"
            ? new Map(
                livePlanRecords(plan.features).map((one) => [one.id, one]),
              )
            : undefined;
        const finished = hiddenUnlessShown({
          rows: plan.features,
          hidden: (feature) => {
            const shown = live === undefined ? feature : live.get(feature.id);
            return (
              shown !== undefined &&
              finishedOnBoard(shown, choices.featureStatuses)
            );
          },
          choice: finishedChoice,
          label: finishedWords.label,
          records: finishedWords.records,
          view,
        });
        const actions: RecordActions<Feature, PlanChange, FeatureFields> = {
          ...actionsFor<Feature, FeatureFields>("feature"),
          ...columnDraftActions("features", changes),
          editColumn: (field) => {
            columnDialog.open({ kind: "edit", field });
          },
          removeColumn: columnRemover("features", changes, withFeatureColumns),
        };
        const { fields, order, lists } = plan.featureColumns;
        return (
          <>
            <TableTips>
              <RecordGrid
                // The table is drawn afresh in each mode, so it measures what it shows.
                key={mode}
                {...shared}
                linkedColumn={linkedColumn}
                panels={panelsWith("feature", table, plan.features, actions)}
                records={onBoard ? finished.rows : plan.features}
                viewChoices={onBoard ? finished.choices : undefined}
                table={table}
                actions={actions}
                fields={fields}
                order={order}
                lists={lists}
                canEditColumns={canEditColumns}
                pageParts={(shown) => boardParts(shown, streams, offeredParts)}
                pageFilter={customerFilter(view, customerLinks)}
                body={
                  onBoard && board !== undefined
                    ? (shown) => (
                        <FeatureBoard
                          shown={shown}
                          streams={streams}
                          choices={choicesQuery.data}
                          place={board.place}
                          onPlace={board.onPlace}
                          offeredParts={offeredParts}
                          open={open}
                          onOpen={openRecord}
                          today={now}
                        />
                      )
                    : undefined
                }
              />
            </TableTips>
            <ColumnModal<ProjectPlan>
              state={columnDialog}
              table="features"
              fields={fields}
              lists={listsToOffer.data ?? lists}
              saving={changes}
              withColumns={withFeatureColumns}
              newColumnButton={newColumnId}
            />
          </>
        );
      },
      customers: () =>
        gridOf(
          "customer",
          customerTable(customerLinks, {
            seesFeatures,
            onOpen: openRecord,
            onFeatures: seesFeatures ? showCustomerFeatures : undefined,
          }),
          plan.customers,
        ),
      proposals: () =>
        gridOf(
          "proposal",
          proposalTable(choices, {
            onOpen: openRecord,
            onFeatures: showFeaturesOf("proposal"),
          }),
          plan.proposals,
        ),
      milestones: () =>
        gridOf(
          "milestone",
          milestoneTable(plan.projects, filteredTo, (milestone) => {
            leave(() => {
              onTab?.("projects", milestone.projectId);
            });
          }),
          allMilestones(plan),
        ),
      projects: () =>
        gridOf(
          "project",
          projectTable(choices, {
            onOpen: openRecord,
            onMilestones: showMilestonesOf,
            onFeatures: showFeaturesOf("project"),
          }),
          plan.projects,
        ),
    };
    // The tab is always one of the fixed tabs.
    // eslint-disable-next-line security/detect-object-injection
    content = grids[tab]();
  }

  return (
    <Stack gap="md" className={classes.tablePage}>
      <PlanPageHeading
        title={page.title}
        tabbed={page.tabbed}
        tab={tab}
        mode={mode}
        onMode={board?.onMode}
        editsColumns={editsFeatureColumns}
        canEdit={canEdit}
        show={view.show}
        columnsReady={query.isSuccess && listsToOffer.isSuccess}
        newReady={query.isSuccess && choicesSettled}
        onTab={(next) => {
          leave(() => {
            onTab?.(next);
          });
        }}
        onNewColumn={() => {
          columnDialog.open({ kind: "new" });
        }}
        onNew={() => {
          leave(() => {
            onOpen?.(undefined);
            setForms((count) => count + 1);
            setBeingAdded({ tab, values: {} });
          });
        }}
      />
      {page.tabbed ? (
        <HeadingTabPanel key={tab} id={tabsId} tab={tab}>
          {content}
        </HeadingTabPanel>
      ) : (
        <Fragment key={tab}>{content}</Fragment>
      )}
      {question.dialog}
      {views.dialogs}
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
              shown(
                (plan) => plan,
                changeSetId,
                () => {
                  undoable(changeSetId, before);
                },
              );
            }}
          />
        )}
      </Modal>
    </Stack>
  );
}
