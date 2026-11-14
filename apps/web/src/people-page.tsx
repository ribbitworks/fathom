// SPDX-License-Identifier: Apache-2.0

// The People page: everyone the user may see, and the planned hires, in a table edited like a
// spreadsheet, with the columns people have added, each drawing on a list. Those who may change
// people add, edit, and delete them, and those who may also change the hiring plan do the same for
// planned hires, adding either from New, in the details panel, or in the table's new row; those who
// may change planning configuration add, change, and delete columns, and move any column. Every
// change to a person is a draft, shown in place until an Approver approves it on the Drafts page.
// Every change shows at once and saves in the background, and the latest can be undone with Cmd+Z
// or Ctrl+Z, or from its notification when it took something out of view. What the table shows,
// its search, filters, and sort, is kept in the page address, and can be saved as a view shared
// with everyone who sees people.

import { LoadProblem } from "./load-problem.tsx";
import type {
  ClassAccess,
  DraftKind,
  HireFill,
  List,
  Person,
  PersonDraft,
  SavedView,
} from "@fathom/shared";
import { defaultClasses } from "@fathom/shared";
import {
  Anchor,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { kept } from "./added-columns.ts";
import {
  columnDraftActions,
  ColumnModal,
  useColumnDialog,
} from "./column-editing.tsx";
import { DecisionModal } from "./decision-dialog.tsx";
import { listsQuery } from "./lists.ts";
import { focusSoon } from "./focus.ts";
import { DateControl } from "./date-control.tsx";
import { PageHeader } from "./page-header.tsx";
import {
  type NewRecord,
  newRecord,
  NewPersonPanel,
  recordQuestion,
} from "./new-person-panel.tsx";
import { entered, newRecordId } from "./new-record-panel.tsx";
import { changedFrom, personUpdate } from "./person-change.ts";
import { afterNote, noteQuestion } from "./note-editing.tsx";
import { usePersonNotes, useShownId } from "./person-editing.tsx";
import { useDiscardQuestion } from "./discard-question.tsx";
import { PersonPanel, personPanelId } from "./person-panel.tsx";
import { useNarrow } from "./side-panel.tsx";
import {
  draftSentAgain,
  pendingDraft,
  type Decision,
  decisionFor,
} from "./drafts.ts";
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
import {
  columnsFor,
  changesFromDay,
  type PeopleActions,
  PeopleGrid,
} from "./people-grid.tsx";
import {
  draftColumn,
  isPending,
  pendingId,
  withLiveValues,
} from "./record-grid.tsx";
import {
  createHires,
  deleteHire,
  discardHireDraft,
  fillHire,
  hireRequest,
  resubmitHireDraft,
} from "./hires.ts";
import {
  addedNames,
  isHire,
  personOnly,
  rowName,
  type RowRequest,
} from "./people-rows.ts";
import {
  createPeople,
  createView,
  deletePerson,
  deleteView,
  discardDraft,
  resubmitDraft,
  type PeopleData,
  peopleQuery,
  peopleQueryOn,
  updateView,
} from "./people.ts";
import { useSaving } from "./saving.ts";
import type { ChangeView, SavedViews } from "./table-controls.tsx";
import { viewParts, viewScopes } from "./table-controls.tsx";
import { type View, savedFor } from "./table-view.ts";
import { type SavedViewResult, ViewDialog } from "./view-dialog.tsx";

const newColumnId = "column-new";

// Naming a saved view: a new one for the view shown, or one to rename.
interface Naming {
  saved?: SavedView;
  view: View;
}

// The saved views with one added or replaced.
function withView(views: readonly SavedView[], saved: SavedView): SavedView[] {
  return views.some((other) => other.id === saved.id)
    ? views.map((other) => (other.id === saved.id ? saved : other))
    : [...views, saved];
}

// Someone or a planned hire being added, as the table shows them before they are saved: a draft
// adding them.
function adding(id: string, request: RowRequest): Person {
  const { values, links, notes, numbers, ...details } = request;
  return {
    id,
    ...details,
    values,
    links: kept(links),
    ...(notes === undefined ? {} : { notes: kept(notes) }),
    ...(numbers === undefined ? {} : { numbers: kept(numbers) }),
    // A draft adding someone changes everything, so names nothing in particular.
    draft: pendingDraft("created", { values: {}, links: {} }),
  };
}

// A person as they are live, without their draft. A web link column the draft changes that is not
// in the live links had no link.
function asLive(person: Person, draft: PersonDraft): Person {
  const { values, links, notes, numbers, ...details } = draft.live;
  const live: Person = {
    ...person,
    ...(details as Partial<Person>),
    values: { ...person.values, ...values },
    links: withLiveValues(person.links, draft.changed, links),
    notes: withLiveValues(person.notes, draft.changed, notes),
    numbers: withLiveValues(person.numbers, draft.changed, numbers),
  };
  delete live.draft;
  return live;
}

// A person drafted to be removed, as the table shows it before it is saved.
function drafted(person: Person): Person {
  return {
    ...person,
    draft: pendingDraft("deleted", { values: {}, links: {} }),
  };
}

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
}: {
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
  const query = useQuery(peopleQueryOn(day));
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
    "aria-describedby": positionHidden ? cannotAddId : undefined,
  };
  const columnDialog = useColumnDialog();
  const [busy, setBusy] = useState(false);
  // Like the column dialog, the naming dialog stays set while it closes.
  const [naming, setNaming] = useState<Naming>();
  const [namingOpened, setNamingOpened] = useState(false);
  // Approving or rejecting drafts, which asks first.
  const [decision, setDecision] = useState<Decision>();
  const [deciding, setDeciding] = useState(false);
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
    blocked: columnDialog.opened || namingOpened || deciding,
  });
  const { save, shown, undoable, done } = changes;

  // A row by name, as menus and notices name it, once the lists, which a row's actions wait for,
  // are loaded.
  const nameOf = (row: Person) =>
    isHire(row)
      ? `the planned hire ${rowName(row, lists.data as List[])}`
      : row.preferredName;

  const actions: PeopleActions = {
    decide: (asking, chosen) => {
      // Approving names the drafts the choice uses, and rejecting those that use it.
      // Drafts are only decided once the people and lists are loaded.
      const { fields, people } = query.data as PeopleData;
      setDecision(
        decisionFor(asking, chosen, approves, lists.data as List[], {
          fields,
          people,
        }),
      );
      setDeciding(true);
    },
    ...columnDraftActions("people", changes),
    add: (added, onAdded, onFailed) => {
      save({
        next: (data) => ({
          ...data,
          people: [
            ...data.people,
            ...added.map(({ id, request }) => adding(id, request)),
          ],
        }),
        save: async () => {
          // People are added together, then planned hires together, each as one change.
          const requests = added.map(({ request }) => request);
          const people = requests.filter((request) => !isHire(request));
          const hires = requests.filter(isHire);
          const savedPeople =
            people.length === 0
              ? { ids: [], changeSetId: null }
              : await createPeople(people.map(personOnly));
          const savedHires =
            hires.length === 0
              ? { ids: [], changeSetId: null }
              : await createHires(hires.map(hireRequest));
          const ids = new Map([
            ...people.map(
              (request, index) => [request, savedPeople.ids.at(index)] as const,
            ),
            ...hires.map(
              (request, index) => [request, savedHires.ids.at(index)] as const,
            ),
          ]);
          const changeSetId = savedHires.changeSetId ?? savedPeople.changeSetId;
          onAdded(requests.map((request) => String(ids.get(request))));
          return changeSetId;
        },
        failure: `Fathom could not add ${addedNames(added.map(({ request }) => request))}. Try again in a moment.`,
        onFailed,
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before);
        },
      });
    },
    update: (person, given) => {
      // From another day, a change of manager is dated from it, against the person's line today.
      // The details panel dates its changes already, which dating again leaves as they are.
      const change =
        from === undefined ? given : changedFrom(given, person.id, from);
      save({
        ...personUpdate(person, change, nameOf(person)),
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before);
        },
      });
    },
    // Removing someone live is a draft, shown in place; removing someone only drafted to be added
    // discards them, which takes them out of view.
    remove: (person) => {
      save({
        next: (data) => ({
          ...data,
          people: data.people.map((other) =>
            other.id === person.id ? drafted(other) : other,
          ),
        }),
        save: () =>
          isHire(person) ? deleteHire(person.id) : deletePerson(person.id),
        failure: `Fathom could not remove ${nameOf(person)}.`,
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before);
        },
      });
    },
    resubmit: (person) => {
      save({
        next: (data) => ({
          ...data,
          people: data.people.map((other) =>
            other.id === person.id ? draftSentAgain(other) : other,
          ),
        }),
        save: () =>
          isHire(person)
            ? resubmitHireDraft(person.id)
            : resubmitDraft(person.id),
        failure: `Fathom could not send the draft of ${nameOf(person)} for approval again.`,
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before);
        },
      });
    },
    discard: (person, draft) => {
      const gone = draft.action === "created";
      save({
        next: (data) => ({
          ...data,
          people: gone
            ? data.people.filter((other) => other.id !== person.id)
            : data.people.map((other) =>
                other.id === person.id ? asLive(other, draft) : other,
              ),
        }),
        save: () =>
          isHire(person)
            ? discardHireDraft(person.id)
            : discardDraft(person.id),
        failure: `Fathom could not discard the draft of ${nameOf(person)}.`,
        onSaved: (changeSetId, before) => {
          if (gone) {
            done(
              `Discarded the draft adding ${nameOf(person)}.`,
              changeSetId,
              before,
            );
          } else {
            undoable(changeSetId, before);
          }
        },
      });
    },
    editColumn: (field) => {
      columnDialog.open({ kind: "edit", field });
    },
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
      failure: `Fathom could not fill ${nameOf(hire)}.`,
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

  const savedViews = (views: SavedView[]): SavedViews => ({
    views,
    applied,
    onApply: (shown, id) => {
      onApply(shown, id);
    },
    onName: (saved, shown) => {
      setNaming(saved ? { saved, view: shown } : { view: shown });
      setNamingOpened(true);
    },
    onUpdate: (saved, shown) => {
      const definition = savedFor(shown);
      save({
        next: (data) => ({
          ...data,
          views: withView(data.views, { ...saved, definition }),
        }),
        save: async () =>
          (await updateView(saved.id, { definition })).changeSetId,
        failure: `Fathom could not update ${saved.name}.`,
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before);
        },
      });
    },
    onDelete: (saved) => {
      save({
        next: (data) => ({
          ...data,
          views: data.views.filter((other) => other.id !== saved.id),
        }),
        save: () => deleteView(saved.id),
        failure: `Fathom could not delete ${saved.name}.`,
        onSaved: (changeSetId, before) => {
          done(`Deleted the ${saved.name} view.`, changeSetId, before);
        },
      });
    },
    onScope: (saved, scope) => {
      save({
        next: (data) => ({
          ...data,
          views: withView(data.views, { ...saved, scope }),
        }),
        save: async () => (await updateView(saved.id, { scope })).changeSetId,
        failure: `Fathom could not change ${saved.name}.`,
        onSaved: (changeSetId, before) => {
          done(
            `${viewScopes[saved.scope].changedVerb} the ${saved.name} view.`,
            changeSetId,
            before,
          );
        },
      });
    },
  });

  // The dialog saved the view itself, so the page shows it at once. A new view is then the one
  // applied.
  const named = ({ view: saved, changeSetId }: SavedViewResult) => {
    setNamingOpened(false);
    shown(
      (data) => ({ ...data, views: withView(data.views, saved) }),
      changeSetId,
      (_saved, before) => {
        undoable(changeSetId, before);
      },
    );
    if (naming?.saved === undefined && naming) {
      onApply(naming.view, saved.id, true);
    }
  };

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
      <Paper withBorder p="xl">
        <Text fz="sm" c="dimmed" ta="center">
          No people yet
        </Text>
      </Paper>
    );
  } else {
    // The column dialog is part of the loaded page, since it needs the columns and lists.
    content = (
      <>
        <PeopleGrid
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
                        onAdd={(request) => {
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
                              focusSoon(`cell-${shownRecord.id}-preferredName`);
                            }
                          });
                        }}
                      />
                    ),
                  },
                ]),
            ...(note === undefined ? [] : [note]),
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
          saved={savedViews(query.data.views)}
        />
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
          opened={namingOpened}
          onClose={() => {
            setNamingOpened(false);
          }}
          closeOnEscape={!busy}
          closeOnClickOutside={!busy}
          withCloseButton={!busy}
          title={naming?.saved ? "Rename view" : "Save view"}
        >
          {naming && (
            <ViewDialog
              {...(naming.saved
                ? { view: naming.saved }
                : {
                    canSaveShared: canEditColumns,
                    saves: viewParts(
                      naming.view,
                      columnsFor(
                        query.data.fields,
                        lists.data,
                        query.data.order,
                        showDates,
                        query.data.people,
                        query.data.positionHidden !== true,
                        showHireDates,
                      ),
                      [draftColumn],
                    ),
                  })}
              views={query.data.views}
              save={(name, scope) =>
                naming.saved
                  ? updateView(naming.saved.id, { name })
                  : createView({
                      name,
                      scope,
                      definition: savedFor(naming.view),
                    })
              }
              onSaved={named}
              onCancel={() => {
                setNamingOpened(false);
              }}
              onBusy={setBusy}
            />
          )}
        </Modal>
        <ColumnModal<PeopleData>
          state={columnDialog}
          table="people"
          fields={query.data.fields}
          lists={lists.data}
          saving={changes}
          permissions={access.permissions}
          withColumns={(data, change) => ({ ...data, ...change(data) })}
          newColumnButton={newColumnId}
        />
      </>
    );
  }

  return (
    <Stack gap="md" className={classes.tablePage}>
      {/* The heading and the date control sit together, as on the Org chart, with nothing between. */}
      <div>
        <PageHeader
          title="People"
          action={
            (changesRows || canEditColumns) && (
              <Group gap="xs">
                {canEditColumns && (
                  <Button
                    id={newColumnId}
                    variant={changesRows ? "default" : "filled"}
                    onClick={() => {
                      columnDialog.open({ kind: "new" });
                    }}
                  >
                    New column
                  </Button>
                )}
                {/* The live people alone are read only. */}
                {changesRows && view.show !== "live" && (
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
                    New
                  </Button>
                )}
              </Group>
            )
          }
        />
        {dates !== undefined && (
          <DateControl
            day={day}
            laterDays={dates.laterDays}
            changes={changesFrom !== undefined}
            onDay={(next) => {
              leave(() => {
                dates.onDay(next);
              });
            }}
          />
        )}
      </div>
      {changesRows && positionHidden && (
        <Text size="sm" c="dimmed" id={cannotAddId}>
          This role can't add people, since it can't see positions.
        </Text>
      )}
      {content}
    </Stack>
  );
}
