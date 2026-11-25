// SPDX-License-Identifier: Apache-2.0

// The People page: everyone the user may see, and the planned hires, in a table edited like a
// spreadsheet, with the columns people have added.

import { LoadProblem } from "./load-problem.tsx";
import type {
  ClassAccess,
  DraftKind,
  HireFill,
  List,
  Person,
} from "@fathom/shared";
import { defaultClasses, sharesViews } from "@fathom/shared";
import {
  Anchor,
  Button,
  Group,
  Loader,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  columnDraftActions,
  columnRemover,
  ColumnModal,
  useColumnDialog,
} from "./column-editing.tsx";
import { useDecisionDialog } from "./decision-dialog.tsx";
import { listsQuery } from "./lists.ts";
import { focusSoon } from "./focus.ts";
import { DateControl } from "./date-control.tsx";
import { PageHeader } from "./page-header.tsx";
import { useTeamColours } from "./org-chart.ts";
import {
  type NewRecord,
  newRecord,
  NewPersonPanel,
  recordQuestion,
} from "./new-person-panel.tsx";
import { entered, newRecordId } from "./new-record-panel.tsx";
import { afterNote, noteQuestion } from "./note-editing.tsx";
import { usePersonNotes, useShownId } from "./person-editing.tsx";
import { useDiscardQuestion } from "./discard-question.tsx";
import { PersonPanel, personPanelId } from "./person-panel.tsx";
import { useNarrow } from "./side-panel.tsx";
import classes from "./pages.module.css";
import {
  fillButtonId,
  HireFillAction,
  HireFillForm,
} from "./hire-fill-form.tsx";
import {
  canFill,
  fillQuestion,
  type HireFilling,
  newFilling,
} from "./hire-fill.ts";
import { columnsFor, type PeopleActions, PeopleGrid } from "./people-grid.tsx";
import { isPending, pendingId } from "./grid-drafts.ts";
import { focusRecordCell } from "./grid-row.tsx";
import type { LinkedColumn } from "./record-table.ts";
import { fillHire } from "./hires.ts";
import { isHire, noticeName, peopleAndHires } from "./people-rows.ts";
import { type PeopleData, peopleQuery, peopleQueryOn } from "./people.ts";
import { peopleRecordActions } from "./people-actions.ts";
import { useSaving } from "./saving.ts";
import type { ChangeView } from "./table-controls.tsx";
import { useSavedViews } from "./saved-views.tsx";
import { formatDay } from "./day-formats.ts";
import type { View } from "./table-view.ts";
import { usePersonTimeline } from "./person-timeline.tsx";
import { today } from "./today.ts";
import { changesFromDay } from "./people-live.ts";

const newColumnId = "column-new";

const withPeopleColumns = (
  data: PeopleData,
  change: (columns: PeopleData) => Partial<PeopleData>,
): PeopleData => ({ ...data, ...change(data) });

const cannotAddId = "people-cannot-add";
const newRecordButtonId = "people-new";

export function PeoplePage({
  canEdit,
  canEditHires = false,
  approves = [],
  canEditColumns,
  showDates,
  showHireDates = showDates,
  view,
  onView,
  applied,
  onApply,
  open,
  onOpen,
  seesFeatureTeams = false,
  access = { permissions: [], dataClasses: defaultClasses },
  dates,
  timeline,
  linkedColumn,
}: {
  // Whether the shown person's timeline is open under their details, and opening or closing it.
  timeline?: { opened: boolean; onShow: (shown: boolean) => void } | undefined;
  // An added column a link opens, whose menu the table opens with open.
  linkedColumn?: LinkedColumn | undefined;
  // The day People is shown as of, and how to choose another, for a role that sees other dates.
  // On another day only a person's manager changes, from that day, in their details, for a role
  // that may date a change then, as on the Org chart; the rest is read only.
  dates?:
    | {
        day: string | undefined;
        laterDays: boolean;
        changes: boolean;
        onDay: (day: string | undefined) => void;
      }
    | undefined;
  canEdit: boolean;
  // Whether the user may change planned hires too.
  canEditHires?: boolean;
  // The kinds of draft the user's role approves and rejects.
  approves?: readonly DraftKind[];
  canEditColumns: boolean;
  showDates: boolean;
  // Whether the user sees planned hires' target dates, which come with the hiring plan.
  showHireDates?: boolean;
  view: View;
  onView: ChangeView;
  // The saved view the view started from, and how to apply one, replacing the current address
  // rather than adding to its history when asked.
  applied: string | undefined;
  onApply: (view: View, id: string, replace?: boolean) => void;
  // The person whose details are shown beside the table, by Employee ID, and showing someone's, or
  // nobody's.
  open?: string | undefined;
  onOpen?: (employeeId: string | undefined, replace?: boolean) => void;
  // Whether the reader sees feature teams, which a person's details then list.
  seesFeatureTeams?: boolean;
  // The role's permissions and the classes people's details are kept in, which mark the columns
  // holding them and decide the classes a column may be moved to.
  access?: ClassAccess;
}) {
  const day = dates?.day;
  // Today as the page opened, which People shows until another day is chosen.
  const [opened] = useState(today);
  const countOn = useCallback(
    (rows: readonly Person[]) =>
      `${peopleAndHires(isHire).counted(rows)} on ${formatDay(day ?? opened)}`,
    [day, opened],
  );
  const query = useQuery(peopleQueryOn(day));
  const teamColourOf = useTeamColours();
  // Changes to rows, columns, and anything undated are made on today.
  const changesRows = canEdit && day === undefined;
  const changesFrom =
    day !== undefined && canEdit && dates?.changes === true ? day : undefined;
  // Today's people, while changes are made from another day, whose lines today decide them.
  const todays = useQuery({
    ...peopleQuery,
    enabled: changesFrom !== undefined,
  });
  const from = useMemo(
    () => changesFromDay(changesFrom, todays.data?.people),
    [changesFrom, todays.data],
  );
  const narrow = useNarrow();
  const positionHidden = query.data?.positionHidden === true;
  const saving =
    useIsMutating({ mutationKey: [...peopleQuery.queryKey, "change"] }) > 0;
  const lists = useQuery(listsQuery);
  // Adding a person or a planned hire waits for the people and lists, and needs positions seen.
  const addButton = {
    disabled: !query.isSuccess || !lists.isSuccess || positionHidden,
    // The line saying why is above the table, drawn once the lists have loaded too.
    "aria-describedby":
      positionHidden && lists.isSuccess ? cannotAddId : undefined,
  };
  const columnDialog = useColumnDialog();
  // Approving or rejecting drafts, which asks first.
  const decisionDialog = useDecisionDialog();
  const views = useSavedViews({
    table: "people",
    within: peopleQuery.queryKey,
    view,
    applied,
    onApply,
    canShare: sharesViews("people", access.permissions),
    blocked: columnDialog.opened || decisionDialog.opened,
  });
  // A record's details, or one being added, and a note of its being written, beside the table.
  const notes = usePersonNotes();
  const [beingAdded, setBeingAdded] = useState<NewRecord>();
  // Each New starts a form afresh, with none of a discarded one's fields.
  const [forms, setForms] = useState(0);
  // The record just added, by Fathom's own ID, whose details show once People has it.
  const justAdded = useRef<(person: Person) => boolean>(undefined);
  // The add being saved, so its outcome changes nothing once the form is closed or replaced.
  const submitted = useRef<NewRecord>(undefined);
  // A planned hire being filled in its details.
  const [filling, setFilling] = useState<HireFilling>();
  const mayFill = changesRows && canEditHires && view.show !== "live";
  const shownId = useShownId(open, query.data?.people);
  // Showing another record, as by Back, leaves the fill of the one before.
  const [fillShown, setFillShown] = useState(shownId);
  if (fillShown !== shownId) {
    setFillShown(shownId);
    if (filling !== undefined && filling.hireId !== shownId) {
      setFilling(undefined);
    }
  }
  // Showing another day, as by Back, leaves an add or fill, which are made on today alone.
  const [dayShown, setDayShown] = useState(day);
  if (dayShown !== day) {
    setDayShown(day);
    setBeingAdded(undefined);
    setFilling(undefined);
  }
  const shownRecord = query.data?.people.find(({ id }) => id === shownId);
  const note = notes.note(beingAdded === undefined ? shownId : newRecordId);
  const question = useDiscardQuestion();
  // What showing another record, or adding one, would discard, if anything: a note changed, or a
  // record being added that holds something.
  const leaving = () =>
    beingAdded !== undefined && entered(beingAdded)
      ? recordQuestion(beingAdded.kind)
      : filling !== undefined && entered(filling)
        ? fillQuestion
        : notes.changing
          ? noteQuestion
          : undefined;
  const leave = (go: () => void) => {
    question.ask(leaving(), () => {
      notes.discard();
      submitted.current = undefined;
      setBeingAdded(undefined);
      setFilling(undefined);
      go();
    });
  };
  const startFill = (hire: Person) => {
    leave(() => {
      onOpen?.(hire.employeeId, open === hire.employeeId);
      setFilling(newFilling(hire));
    });
  };
  const showRecord = (employeeId: string | undefined, replace = false) => {
    leave(() => {
      onOpen?.(employeeId, replace);
    });
  };
  const personTimeline = usePersonTimeline({
    people: query.data?.people,
    shown: shownRecord,
    shownOn: day,
    opened: timeline?.opened === true,
    onShow: (opened) => {
      timeline?.onShow(opened);
    },
    showDates,
    seesFeatureTeams,
    dates,
    leave,
    showRecord,
    open,
    narrow,
  });
  useEffect(() => {
    if (justAdded.current === undefined) return;
    const added = query.data?.people.find(
      (one) => justAdded.current?.(one) === true && !isPending(one),
    );
    if (added === undefined) return;
    justAdded.current = undefined;
    onOpen?.(added.employeeId, true);
  }, [query.data, onOpen]);
  const changes = useSaving<PeopleData>({
    queryKey: peopleQueryOn(day).queryKey,
    refreshes: day === undefined ? [] : [peopleQuery.queryKey],
    removed: "Someone else has removed this. The people have been refreshed.",
    blocked: columnDialog.opened || views.opened || decisionDialog.opened,
  });
  const { save, undoable } = changes;

  const actions: PeopleActions = {
    ...peopleRecordActions({
      changes,
      data: query.data,
      lists: lists.data,
      approves,
      onDecision: decisionDialog.open,
      from,
    }),
    ...columnDraftActions("people", changes),
    editColumn: (field) => {
      columnDialog.open({ kind: "edit", field });
    },
    removeColumn: columnRemover("people", changes, withPeopleColumns),
    ...(access.permissions.includes("data:classify")
      ? {
          moveColumnClass: (field, from) => {
            columnDialog.open({ kind: "move", field, from });
          },
        }
      : {}),
  };

  // Saves the fill as one draft. The form stays open, with what was entered, if it is refused.
  const fill = (hire: Person, request: HireFill) => {
    setFilling((current) => current && { ...current, saving: true });
    save({
      // Readers who see Personal details are told who; the reload says for the rest.
      next: (data) => ({
        ...data,
        people: data.people.map((other) =>
          other.id === hire.id
            ? {
                ...other,
                filler:
                  request.by === "existing person" ? request.personId : null,
              }
            : other,
        ),
      }),
      save: () => fillHire(hire.id, request),
      failure: `Fathom could not fill ${noticeName(hire, lists.data as List[])}.`,
      onFailed: () => {
        setFilling((current) => current && { ...current, saving: false });
      },
      onSaved: (changeSetId, before) => {
        setFilling(undefined);
        justAdded.current = ({ id, employeeId }) =>
          request.by === "new person"
            ? employeeId === request.employeeId
            : id === request.personId;
        undoable(changeSetId, before);
      },
    });
  };

  const dateRow = dates !== undefined && (
    <DateControl
      day={day}
      laterDays={dates.laterDays}
      onDay={(next) => {
        leave(() => {
          dates.onDay(next);
        });
      }}
    />
  );
  let content: ReactNode;
  if (query.isPending || lists.isPending) {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (query.isError || lists.isError) {
    content = (
      <LoadProblem
        what="the people"
        onRetry={() => {
          void query.refetch();
          void lists.refetch();
        }}
      />
    );
  } else if (query.data.people.length === 0 && !changesRows) {
    content = (
      <div>
        {dateRow}
        <Paper withBorder p="xl">
          <Text fz="sm" c="dimmed" ta="center">
            No people yet
          </Text>
        </Paper>
      </div>
    );
  } else {
    // The column dialog is part of the loaded page, since it needs the columns and lists.
    content = (
      <>
        <PeopleGrid
          selected={shownId}
          linkedColumn={linkedColumn}
          teamColourOf={teamColourOf}
          count={countOn}
          dataClasses={access.dataClasses}
          // On a day where nothing can be changed, People is read as approved, as the Org chart is.
          withDrafts={day === undefined || changesFrom !== undefined}
          onOpen={
            onOpen &&
            ((person) => {
              showRecord(person.employeeId);
            })
          }
          onFill={mayFill ? startFill : undefined}
          panels={[
            ...(beingAdded === undefined
              ? []
              : [
                  {
                    key: "person",
                    id: personPanelId,
                    name: "details",
                    node: (
                      <NewPersonPanel
                        key={forms}
                        record={beingAdded}
                        onRecord={(update) => {
                          setBeingAdded(
                            (current) => current && update(current),
                          );
                        }}
                        people={query.data.people}
                        lists={lists.data}
                        allColumns={columnsFor(
                          query.data.fields,
                          lists.data,
                          query.data.order,
                          showDates,
                          query.data.people,
                          !positionHidden,
                          showHireDates,
                          canEditHires,
                        )}
                        narrow={narrow}
                        notes={notes}
                        onAdd={(request, refused) => {
                          afterNote(notes, question.ask, () => {
                            const id = pendingId();
                            const saving = { ...beingAdded, saving: true };
                            submitted.current = saving;
                            setBeingAdded(saving);
                            actions.add(
                              [{ id, request }],
                              ([saved]) => {
                                if (submitted.current !== saving) return;
                                submitted.current = undefined;
                                setBeingAdded(undefined);
                                justAdded.current = ({ id }) => id === saved;
                              },
                              () => {
                                if (submitted.current !== saving) return;
                                submitted.current = undefined;
                                setBeingAdded({ ...saving, saving: false });
                              },
                              refused,
                            );
                          });
                        }}
                        onCancel={() => {
                          leave(() => {
                            focusSoon(newRecordButtonId);
                          });
                        }}
                      />
                    ),
                  },
                ]),
            ...(beingAdded !== undefined ||
            open === undefined ||
            onOpen === undefined
              ? []
              : [
                  {
                    key: "person",
                    id: personPanelId,
                    name: "details",
                    node: (
                      <PersonPanel
                        timeline={personTimeline.details}
                        shownOn={day}
                        employeeId={open}
                        show={view.show}
                        showDates={showDates}
                        showHireDates={showHireDates}
                        canEditHires={canEditHires}
                        seesFeatureTeams={seesFeatureTeams}
                        narrow={narrow}
                        elsewhere={(person) =>
                          !isHire(person) && (
                            <Anchor
                              size="sm"
                              renderRoot={(props) => (
                                <Link
                                  {...props}
                                  to="/org-chart"
                                  search={{ person: person.employeeId }}
                                />
                              )}
                            >
                              Show on org chart
                            </Anchor>
                          )
                        }
                        onPerson={showRecord}
                        onFollow={(next) => {
                          onOpen(next, true);
                        }}
                        onChange={
                          changesRows || changesFrom !== undefined
                            ? actions.update
                            : undefined
                        }
                        changesFrom={changesFrom}
                        notes={notes}
                        hireFill={(hire, shownPeople, columns) =>
                          filling?.hireId === hire.id
                            ? {
                                form: (
                                  <HireFillForm
                                    hire={hire}
                                    people={shownPeople}
                                    lists={lists.data}
                                    columns={columns}
                                    filling={filling}
                                    onFilling={(update) => {
                                      setFilling(
                                        (current) => current && update(current),
                                      );
                                    }}
                                    notes={notes}
                                    onFill={(request) => {
                                      afterNote(notes, question.ask, () => {
                                        fill(hire, request);
                                      });
                                    }}
                                    onCancel={() => {
                                      question.ask(
                                        entered(filling)
                                          ? fillQuestion
                                          : undefined,
                                        () => {
                                          setFilling(undefined);
                                          focusSoon(fillButtonId);
                                        },
                                      );
                                    }}
                                  />
                                ),
                              }
                            : {
                                action: (
                                  <HireFillAction
                                    hire={hire}
                                    people={shownPeople}
                                    columns={columns}
                                    onPerson={showRecord}
                                    onFill={
                                      mayFill && canFill(hire, lists.data)
                                        ? () => {
                                            startFill(hire);
                                          }
                                        : undefined
                                    }
                                  />
                                ),
                              }
                        }
                        onClose={() => {
                          leave(() => {
                            onOpen(undefined);
                            if (shownRecord !== undefined) {
                              focusRecordCell(shownRecord.id, "preferredName");
                            }
                          });
                        }}
                      />
                    ),
                  },
                ]),
            ...(note === undefined ? [] : [note]),
            ...(personTimeline.panel === undefined
              ? []
              : [personTimeline.panel]),
          ]}
          people={query.data.people}
          fields={query.data.fields}
          order={query.data.order}
          lists={lists.data}
          canEdit={changesRows || changesFrom !== undefined}
          changesFrom={from}
          canEditHires={canEditHires}
          approves={approves}
          saving={saving}
          canEditColumns={canEditColumns}
          showDates={showDates}
          showHireDates={showHireDates}
          showPosition={query.data.positionHidden !== true}
          actions={actions}
          view={view}
          onView={onView}
          above={
            dateRow !== false || (changesRows && positionHidden)
              ? () => (
                  <>
                    {dateRow}
                    {changesRows && positionHidden && (
                      <Text size="sm" c="dimmed" mb="sm" id={cannotAddId}>
                        This role can't add people, since it can't see
                        positions.
                      </Text>
                    )}
                  </>
                )
              : undefined
          }
          saved={views.saved}
        />
        {question.dialog}
        {decisionDialog.modal}
        {views.dialogs}
        <ColumnModal<PeopleData>
          state={columnDialog}
          table="people"
          fields={query.data.fields}
          lists={lists.data}
          saving={changes}
          permissions={access.permissions}
          withColumns={withPeopleColumns}
          newColumnButton={newColumnId}
        />
      </>
    );
  }

  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader
        title="People"
        action={
          // Changing People's columns takes changing people, so needs these rows too.
          changesRows && (
            <Group gap="xs">
              {canEditColumns && (
                <Button
                  id={newColumnId}
                  variant="default"
                  onClick={() => {
                    columnDialog.open({ kind: "new" });
                  }}
                >
                  New column
                </Button>
              )}
              {/* The live people alone are read only. */}
              {view.show !== "live" && (
                <Button
                  id={newRecordButtonId}
                  variant="filled"
                  {...addButton}
                  onClick={() => {
                    leave(() => {
                      onOpen?.(undefined);
                      setForms((count) => count + 1);
                      setBeingAdded(newRecord());
                    });
                  }}
                >
                  New person
                </Button>
              )}
            </Group>
          )
        }
      />
      {content}
    </Stack>
  );
}
