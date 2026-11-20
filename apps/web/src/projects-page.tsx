// SPDX-License-Identifier: Apache-2.0

// The plan's records, each a table edited like People's: the Projects page, with a tab each for
// projects, proposals, customers and milestones, and the Features page, as a table or a board.

import type {
  Asking,
  DraftKind,
  Feature,
  Milestone,
  Project,
  ProjectPlan,
  Proposal,
} from "@fathom/shared";
import {
  allOf,
  cardPartSchema,
  type PlanMode,
  withRemovalReason,
} from "@fathom/shared";
import { Button, Group, Loader, Modal, Stack } from "@mantine/core";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { effortConversionsQuery } from "./effort.ts";
import {
  type BoardPlace,
  focusCard,
  FeatureBoard,
} from "./feature-board-view.tsx";
import { boardParts, planModes } from "./feature-board.ts";
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
import type { CellChange } from "./cell-kinds.tsx";
import {
  columnDraftActions,
  columnRemover,
  ColumnModal,
  useColumnDialog,
} from "./column-editing.tsx";
import { DecisionModal } from "./decision-dialog.tsx";
import { draftSentAgain, noDrafts, type DraftSelection } from "./drafts.ts";
import { type Decision, decisionFor } from "./draft-decisions.ts";
import { listsQuery } from "./lists.ts";
import { LoadProblem } from "./load-problem.tsx";
import {
  HeadingTabPanel,
  HeadingTabs,
  ModeSwitch,
  PageHeader,
} from "./page-header.tsx";
import classes from "./pages.module.css";
import { featureTable } from "./feature-table.tsx";
import { livePlanRecords, type PlanChange, wordsOf } from "./plan-table.tsx";
import {
  customerTable,
  milestoneTable,
  noColumnActions,
  PlanGrid,
  projectTable,
  proposalTable,
} from "./project-grids.tsx";
import {
  allMilestones,
  changeRemovalReason,
  type FeatureFields,
  type FeatureNamer,
  type MilestoneAdding,
  operationsOf,
  listedPlanRecords,
  planChoicesQuery,
  planNodes,
  type PlanRecord,
  type PlanRecordKind,
  type PlanTab,
  projectPlanQuery,
  namesOf,
  projectTabs,
  tableChoices,
} from "./projects.ts";
import {
  adding,
  discarded,
  newestId,
  removing,
  withAdded,
  withFeatureColumns,
  withRecord,
  withRecordChange,
} from "./plan-record-changes.ts";
import {
  detailTabs,
  MilestoneForm,
  panelId,
  panelTitleId,
  recordPanel,
} from "./plan-record-panel.tsx";
import { pendingId } from "./grid-drafts.ts";
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
import {
  discardRecordDraft,
  releaseStreamsQuery,
  resubmitRecordDraft,
} from "./releases.ts";
import { useSavedViews } from "./saved-views.tsx";
import { useSaving } from "./saving.ts";
import { type SidePanel, useNarrow } from "./side-panel.tsx";
import type { ChangeView } from "./table-controls.tsx";
import type { View } from "./table-view.ts";

export const projectTabSchema = z.enum(projectTabs);

const newButtonId = "projects-new";
const newColumnId = "features-new-column";
const tabsId = "projects-tabs";

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
  view,
  onView,
  applied,
  onApply,
  canShareViews = false,
  open,
  onOpen,
  onMilestonesOf,
  onFeaturesOf,
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
  // Anything that would close the form asks first, while it holds something.
  const leave = (go: () => void) => {
    if (beingAdded?.saving === true) return;
    question.ask(
      beingAdded !== undefined && entered(beingAdded)
        ? newRecordQuestion(wordsOf(beingAdded.tab).one)
        : notes.changing
          ? noteQuestion
          : undefined,
      () => {
        notes.discard();
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
  const { save, shown, undoable, done } = changes;
  const canEdit = query.data !== undefined && page.mayEdit(query.data);

  const decide = (asking: Asking, chosen: DraftSelection, all?: boolean) => {
    const plan = query.data as ProjectPlan;
    setDecision(
      decisionFor(
        asking,
        chosen,
        approves,
        plan.featureColumns.lists,
        { fields: plan.featureColumns.fields, records: planNodes(plan) },
        all,
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

  const changeReason = (
    featureId: string,
    proposal: Proposal,
    removalReason: string | null,
  ) => {
    const features = namesOf((query.data as ProjectPlan).features, [featureId]);
    save({
      next: (plan) =>
        withRecord(plan, "proposal", proposal.id, (shown) => ({
          ...shown,
          removalReasons: withRemovalReason(
            proposal.removalReasons,
            featureId,
            removalReason,
          ),
        })),
      save: async () =>
        (await changeRemovalReason(featureId, proposal.id, { removalReason }))
          .changeSetId,
      failure: `Fathom could not change the reason for removing ${allOf(features)} from ${proposal.name}. Try again in a moment.`,
      onSaved: undoable,
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
                adding(type, id, request as CellChange),
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
          failure: `Fathom could not add ${allOf(
            added.map(({ request }) => (request as { name: string }).name),
          )}. Try again in a moment.`,
          onFailed,
          onSaved: undoable,
        });
      },
      update: (record, change) => {
        save({
          next: (plan) => withRecordChange(plan, type, record.id, change),
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
      approves,
      nodes,
      onClose: () => {
        onOpen?.(undefined);
        if (onBoard) focusCard(String(open));
        else focusRecordCell(String(open), "name");
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
    });
    const shared = {
      canEdit,
      approves,
      saving,
      view,
      onView,
      saved: views.saved,
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
        return [...(panel === undefined ? [] : [panel]), ...writing];
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
              onAdd={(request) => {
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
      return (
        <TableTips>
          <PlanGrid
            {...shared}
            panels={panelsWith(type, table, records, actions)}
            records={records}
            table={table}
            actions={actions}
          />
        </TableTips>
      );
    }
    const filteredTo = view.filters.projectId?.any?.at(0);
    const grids: Readonly<Record<PlanTab, () => ReactElement>> = {
      features: () => {
        const table = featureTable(choices, {
          onOpen: openRecord,
          editsNamers: plan.canEdit,
          board: onBoard,
        });
        const offeredParts = cardPartSchema.options;
        const actions: RecordActions<Feature, PlanChange, FeatureFields> = {
          ...actionsFor<Feature, FeatureFields>("feature"),
          ...columnDraftActions("features", changes),
          editColumn: (field) => {
            columnDialog.open({ kind: "edit", field });
          },
          ...(plan.canEditFeatures
            ? {
                removeColumn: columnRemover(
                  "features",
                  changes,
                  withFeatureColumns,
                ),
              }
            : {}),
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
                records={plan.features}
                table={table}
                actions={actions}
                fields={fields}
                order={order}
                lists={lists}
                canEditColumns={canEditColumns}
                pageParts={(shown) => boardParts(shown, streams, offeredParts)}
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
              canDelete={plan.canEditFeatures}
              saving={changes}
              withColumns={withFeatureColumns}
              newColumnButton={newColumnId}
            />
          </>
        );
      },
      customers: () =>
        gridOf("customer", customerTable(openRecord), plan.customers),
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
      <PageHeader
        title={page.title}
        beside={
          page.tabbed ? (
            <HeadingTabs
              id={tabsId}
              label={`${page.title} tables`}
              tabs={projectTabs.map((one) => ({
                value: one,
                label: wordsOf(one).label,
              }))}
              tab={tab}
              onTab={(next) => {
                leave(() => {
                  onTab?.(next);
                });
              }}
            />
          ) : (
            tab === "features" &&
            board !== undefined && (
              <ModeSwitch modes={planModes} mode={mode} onMode={board.onMode} />
            )
          )
        }
        action={
          <Group gap="xs">
            {editsFeatureColumns && (
              <Button
                id={newColumnId}
                variant={canEdit ? "default" : "filled"}
                disabled={!query.isSuccess || !listsToOffer.isSuccess}
                onClick={() => {
                  columnDialog.open({ kind: "new" });
                }}
              >
                New column
              </Button>
            )}
            {/* The live records alone are read only. */}
            {canEdit && view.show !== "live" && (
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
            )}
          </Group>
        }
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
