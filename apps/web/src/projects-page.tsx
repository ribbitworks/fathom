// SPDX-License-Identifier: Apache-2.0

// The plan's records, each a table edited like People's: the Projects page, with its projects,
// proposals, customers, and milestones, a tab each, a record's details beside it, and a project's
// milestones there too; and the Features page, grouped by cycle, or shown as a board of one stream's
// cycles. Every change is a draft, shown in place until an Approver approves it, from a record's menu
// or the Draft menu. Those who only see the plan see the same tables, read only. The tab, the
// table's view, the board's place, and the record shown are kept in the page address.

import type {
  Asking,
  DraftKind,
  Feature,
  Milestone,
  MilestoneRequest,
  Project,
  ProjectPlan,
  Proposal,
  RecordRef,
  Show,
} from "@fathom/shared";
import {
  allOf,
  cardPartSchema,
  type PlanMode,
  withRemovalReason,
} from "@fathom/shared";
import { Button, Group, Loader, Menu, Modal, Stack, Text } from "@mantine/core";
import { useIsMutating, useMutation, useQuery } from "@tanstack/react-query";
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
  type SubmitEvent,
  type ReactElement,
  type ReactNode,
  useEffect,
  useRef,
  useState,
} from "react";
import { z } from "zod";
import { withCellChange } from "./added-columns.ts";
import { type CellChange, cellKinds } from "./cell-kinds.tsx";
import {
  columnDraftActions,
  columnRemover,
  ColumnModal,
  useColumnDialog,
} from "./column-editing.tsx";
import { DecisionModal } from "./decision-dialog.tsx";
import { DialogActions } from "./dialog-actions.tsx";
import {
  type Decision,
  decisionFor,
  draftSentAgain,
  noDrafts,
  pendingDraft,
  unsavedKeyNumber,
  type DraftSelection,
} from "./drafts.ts";
import { Icon } from "./icons.tsx";
import { listsQuery } from "./lists.ts";
import { LoadProblem } from "./load-problem.tsx";
import {
  HeadingTabPanel,
  HeadingTabs,
  ModeSwitch,
  PageHeader,
} from "./page-header.tsx";
import classes from "./pages.module.css";
import details from "./record-details.module.css";
import {
  customerTable,
  dayOrEmpty,
  addedColumnsTitle,
  featureColumnGroups,
  featureColumns,
  featureTable,
  releaseColumnKey,
  type Identified,
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
  RecordName,
  wordsOf,
} from "./project-grids.tsx";
import {
  addMilestone,
  allMilestones,
  changeRemovalReason,
  changeMilestone,
  type FeatureFields,
  type FeatureNamer,
  isFeature,
  isProposal,
  type MilestoneAdding,
  namersIn,
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
  type TableChoices,
  streamOfReleaseGroup,
  tableChoices,
  withNamers,
} from "./projects.ts";
import { ScopeHistory } from "./scope-history.tsx";
import {
  inUnitsWords,
  RecordLinkList,
  RecordSection,
  Row,
  DetailSections,
} from "./record-details.tsx";
import {
  type Column,
  focusRecordCell,
  heldBack,
  inViewUnits,
  newRecordProblems,
  pendingId,
  type LinkedColumn,
  RecordGrid,
  recordsAsShown,
  type RecordActions,
  type RecordTable,
} from "./record-grid.tsx";
import {
  type Editing,
  useChosenUnits,
  useRecordEditing,
} from "./record-editing.tsx";
import { newRecordQuestion, useDiscardQuestion } from "./discard-question.tsx";
import { entered, type FormValues, newRecordId } from "./new-record-panel.tsx";
import {
  afterNote,
  type NoteContext,
  type NoteEditing,
  noteQuestion,
  useNoteEditing,
} from "./note-editing.tsx";
import { isMilestoneField, MilestoneField } from "./milestone-field.tsx";
import { NewPlanRecordPanel, noOthers } from "./new-plan-record-panel.tsx";
import { focusSoon } from "./focus.ts";
import { type RecordNode, recordNode } from "./record-drafts.ts";
import { RecordMenu } from "./record-menu.tsx";
import {
  discardRecordDraft,
  releaseStreamsQuery,
  resubmitRecordDraft,
} from "./releases.ts";
import { useSavedViews } from "./saved-views.tsx";
import { RecordKey } from "./record-key.tsx";
import { useSaving } from "./saving.ts";
import {
  type SidePanel,
  SidePanelFrame,
  sidePanelScroll,
  useNarrow,
} from "./side-panel.tsx";
import { besideLive, DraftedItem, MarkRow } from "./status-mark.tsx";
import type { ChangeView } from "./table-controls.tsx";
import { type CellValue, formatDay, type View } from "./table-view.ts";

export const projectTabSchema = z.enum(projectTabs);

const newButtonId = "projects-new";
const newColumnId = "features-new-column";
const tabsId = "projects-tabs";
const panelId = "project-record-panel";
const panelTitleId = "project-record-panel-title";

const withFeatureColumns = (
  plan: ProjectPlan,
  change: (
    columns: ProjectPlan["featureColumns"],
  ) => Partial<ProjectPlan["featureColumns"]>,
): ProjectPlan => ({
  ...plan,
  featureColumns: { ...plan.featureColumns, ...change(plan.featureColumns) },
});

// A record being added, as the table shows it before it is saved: a draft adding it.
function adding(
  kind: PlanRecordKind,
  id: string,
  request: CellChange,
): PlanRecord {
  const blank = operationsOf(kind).blank;
  return {
    ...blank,
    ...request,
    ...("values" in blank ? withCellChange(blank, request) : {}),
    id,
    keyNumber: unsavedKeyNumber,
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

// A record with a change applied, as the table shows it before it is saved.
const withChange = (record: PlanRecord, change: PlanChange): PlanRecord => ({
  ...record,
  ...change,
  ...(isFeature(record) ? withCellChange(record, change) : {}),
});

// The plan with a change to a record applied, as the table shows it before it is saved: the
// projects and proposals that name a feature hold it, rather than the feature.
function withRecordChange(
  plan: ProjectPlan,
  type: PlanRecordKind,
  id: string,
  change: PlanChange,
): ProjectPlan {
  const { namers, own } = namersIn(change);
  return withNamers(
    withRecord(plan, type, id, (shown) => withChange(shown, own)),
    id,
    namers,
  );
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
  // Each tab, and Features, keeps saved views of its own.
  const views = useSavedViews({
    table: tab,
    within: projectPlanQuery.queryKey,
    applied,
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

  const decide = (asking: Asking, chosen: DraftSelection) => {
    const plan = query.data as ProjectPlan;
    setDecision(
      decisionFor(asking, chosen, approves, plan.featureColumns.lists, {
        fields: plan.featureColumns.fields,
        records: planNodes(plan),
      }),
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

const milestoneFields = milestoneColumns([]).filter(isMilestoneField);

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
          <MilestoneField
            key={column.key}
            column={column}
            value={values[column.key] as CellValue}
            problem={
              submitted
                ? problems.find((one) => one.column === column.key)?.message
                : undefined
            }
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

// The tabs whose records each page or tab shows the details of beside its table: Features shows the
// projects and proposals that name its features too, so the roadmap stays in view.
type DetailTab = Exclude<PlanTab, "milestones">;

const detailTabs: Readonly<Record<PlanTab, readonly DetailTab[]>> = {
  projects: ["projects"],
  proposals: ["proposals"],
  customers: ["customers"],
  milestones: [],
  features: ["features", "projects", "proposals"],
};

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
  units,
  editsKind,
  approves,
  nodes,
  onClose,
  menu,
  showMilestones,
  follow,
  onChange,
  changeReason,
  notes,
}: {
  tab: PlanTab;
  plan: ProjectPlan;
  choices: TableChoices;
  open: string | undefined;
  narrow: boolean;
  show: Show;
  // The units and decimal places the table shows its columns in.
  units: Pick<View, "units" | "places">;
  // Whether the user may change a kind of record here.
  editsKind: (type: PlanRecordKind) => boolean;
  approves: readonly DraftKind[];
  nodes: readonly RecordNode[];
  onClose: () => void;
  menu: MilestoneMenu;
  showMilestones: (project: Project) => void;
  follow: Follow;
  onChange: (
    type: PlanRecordKind,
    record: PlanRecord,
    change: PlanChange,
  ) => void;
  // Saves the reason for a draft removing a feature from a proposal.
  changeReason: (
    featureId: string,
    proposal: Proposal,
    reason: string | null,
  ) => void;
  notes: Pick<NoteEditing, "start">;
}): SidePanel | undefined {
  if (open === undefined) return undefined;
  const asShown = <Rec extends PlanRecord>(records: readonly Rec[]) =>
    show === "live" ? livePlanRecords(records) : records;
  const shownOf = (
    type: PlanRecordKind,
    records: readonly PlanRecord[],
    columns: () => readonly Column<never, PlanChange>[],
  ) => {
    const record = asShown(records).find(({ id }) => id === open);
    // The record's draft, whatever the view, which marks it and the values it changes, so the Draft
    // view decides how they show.
    const ownDraft = records.find(({ id }) => id === open)?.draft;
    return record === undefined
      ? undefined
      : { type, record, columns, ownDraft };
  };
  const shownFrom: Readonly<
    Record<DetailTab, () => ReturnType<typeof shownOf>>
  > = {
    projects: () =>
      shownOf("project", plan.projects, () =>
        projectColumns(choices).filter(
          ({ key }) => !projectDateColumns.some(([date]) => date === key),
        ),
      ),
    proposals: () =>
      shownOf("proposal", plan.proposals, () => proposalColumns(choices)),
    customers: () =>
      shownOf("customer", plan.customers, () =>
        customerTable().columnsFor([], [], [], []),
      ),
    features: () =>
      shownOf("feature", plan.features, () =>
        featureColumns(choices, { editsNamers: editsKind("project") }),
      ),
  };
  // The tab is always one of the fixed tabs.
  // eslint-disable-next-line security/detect-object-injection
  const found = detailTabs[tab]
    .map((one) =>
      // eslint-disable-next-line security/detect-object-injection
      shownFrom[one](),
    )
    .find((one) => one !== undefined);
  if (found === undefined) return undefined;
  const { type, record: shown, ownDraft } = found;
  const columns = found.columns();
  const canEdit = editsKind(type);
  const identified = new Map<string, Identified>(
    [
      ...asShown(plan.customers),
      ...asShown(plan.projects),
      ...asShown(plan.proposals),
    ].map((one) => [one.id, one]),
  );
  // Projects and proposals, which name features, show their scope history.
  const scope =
    "featureIds" in shown ? (
      <ScopeHistory
        type={isProposal(shown) ? "proposal" : "project"}
        record={shown}
        features={asShown(plan.features)}
        show={show}
        onShow={(featureId) => {
          follow.showRecord("features", featureId);
        }}
        onChangeReason={
          isProposal(shown) && canEdit
            ? (featureId, reason) => {
                changeReason(featureId, shown, reason);
              }
            : undefined
        }
      />
    ) : null;
  const extra =
    type === "project" ? (
      <ProjectExtras
        project={shown as Project}
        show={show}
        canEdit={canEdit}
        approves={approves}
        nodes={nodes}
        menu={menu}
        showMilestones={showMilestones}
      />
    ) : null;
  return {
    key: "record",
    id: panelId,
    name: "details",
    node: (
      <SidePanelFrame
        id={panelId}
        titleId={panelTitleId}
        narrow={narrow}
        title={shown.name}
        marked={(heading) => (
          <DraftedItem draft={ownDraft} heldBy={shown.heldBy}>
            {heading}
          </DraftedItem>
        )}
        subtitle={
          <RecordKey record={{ kind: type, keyNumber: shown.keyNumber }} />
        }
        close={{ label: "Close details", onClose }}
      >
        <div className={sidePanelScroll}>
          <DetailSections>
            <PlanRecordDetails
              // Each record's details start in the units the table shows.
              key={shown.id}
              columns={columns}
              units={units}
              record={shown}
              ownDraft={ownDraft}
              canEdit={canEdit}
              identified={identified}
              follow={follow}
              onChange={(change) => {
                onChange(type, shown, change);
              }}
              sections={type === "feature" ? featureColumnGroups : undefined}
              notes={notes}
            />
            {extra}
            {scope}
          </DetailSections>
        </div>
      </SidePanelFrame>
    ),
  };
}

// What a panel's links show: a record on one of the plan's tabs, or a stream on Releases.
interface Follow {
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
function PlanRecordDetails({
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
  notes: Pick<NoteEditing, "start">;
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
  const shown =
    linkedPage !== undefined && Array.isArray(value) && value.length > 0 ? (
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
