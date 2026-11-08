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

import type {
  DraftKind,
  Field,
  List,
  Person,
  PersonDraft,
  SavedView,
} from "@fathom/shared";
import {
  Alert,
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
import { type ReactNode, useEffect, useRef, useState } from "react";
import { ColumnDialog } from "./column-dialog.tsx";
import { DecisionModal } from "./decision-dialog.tsx";
import { listsQuery } from "./lists.ts";
import { focusSoon } from "./focus.ts";
import { PageHeader } from "./page-header.tsx";
import {
  entered,
  type NewRecord,
  newRecord,
  newRecordId,
  NewRecordPanel,
  recordQuestion,
} from "./new-record-panel.tsx";
import { kept, personUpdate } from "./person-change.ts";
import {
  noteQuestion,
  useDiscardQuestion,
  useNoteEditing,
  useShownId,
} from "./person-editing.tsx";
import { PersonPanel, personPanelId } from "./person-panel.tsx";
import { useNarrow } from "./side-panel.tsx";
import { type Decision, decisionFor } from "./drafts.ts";
import classes from "./pages.module.css";
import { columnsFor, type PeopleActions, PeopleGrid } from "./people-grid.tsx";
import { draftColumn, isPending, pendingId } from "./record-grid.tsx";
import {
  createHires,
  deleteHire,
  discardHireDraft,
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
  deleteField,
  deletePerson,
  deleteView,
  discardColumnDraft,
  discardDraft,
  resubmitColumnDraft,
  resubmitDraft,
  moveColumn,
  type PeopleData,
  peopleQuery,
  updateView,
} from "./people.ts";
import { useSaving } from "./saving.ts";
import type { ChangeView, SavedViews } from "./table-controls.tsx";
import { viewParts } from "./table-controls.tsx";
import { type View, savedFor } from "./table-view.ts";
import { type SavedViewResult, ViewDialog } from "./view-dialog.tsx";

const newColumnId = "column-new";

type Dialog = { kind: "new" } | { kind: "edit"; field: Field };

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
  const { values, links, notes, ...details } = request;
  return {
    id,
    ...details,
    values,
    links: kept(links),
    ...(notes === undefined ? {} : { notes: kept(notes) }),
    draft: {
      action: "created",
      // A draft adding someone changes everything, so names nothing in particular.
      changed: [],
      live: { values: {}, links: {} },
      state: "waiting",
      madeBy: null,
      madeAt: new Date().toISOString(),
    },
  };
}

// A person as they are live, without their draft. A web link column the draft changes that is not
// in the live links had no link.
function asLive(person: Person, draft: PersonDraft): Person {
  const { values, links, notes, ...details } = draft.live;
  const live: Person = {
    ...person,
    ...(details as Partial<Person>),
    values: { ...person.values, ...values },
    links: {
      ...Object.fromEntries(
        Object.entries(person.links).filter(
          ([key]) => !draft.changed.includes(key),
        ),
      ),
      ...links,
    },
    notes: {
      ...Object.fromEntries(
        Object.entries(person.notes ?? {}).filter(
          ([key]) => !draft.changed.includes(key),
        ),
      ),
      ...notes,
    },
  };
  delete live.draft;
  return live;
}

// A person drafted to be removed, as the table shows it before it is saved.
function drafted(person: Person): Person {
  return {
    ...person,
    draft: {
      action: "deleted",
      changed: [],
      live: { values: {}, links: {} },
      state: "waiting",
      madeBy: null,
      madeAt: new Date().toISOString(),
    },
  };
}

// The column order with one column taken out and put back just after another, or at the start.
function reordered(
  order: readonly string[],
  key: string,
  after: string | null,
): string[] {
  const others = order.filter((other) => other !== key);
  const at = after === null ? 0 : others.indexOf(after) + 1;
  return [...others.slice(0, at), key, ...others.slice(at)];
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
  seesChart = false,
}: {
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
  // Whether the reader sees the org chart, which a person's details then link to.
  seesChart?: boolean;
}) {
  const query = useQuery(peopleQuery);
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
  // The dialog stays set while it closes, so its content does not vanish mid-animation.
  const [dialog, setDialog] = useState<Dialog>();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  // Like the column dialog, the naming dialog stays set while it closes.
  const [naming, setNaming] = useState<Naming>();
  const [namingOpened, setNamingOpened] = useState(false);
  // Approving or rejecting drafts, which asks first.
  const [decision, setDecision] = useState<Decision>();
  const [deciding, setDeciding] = useState(false);
  // A record's details, or one being added, and a note of its being written, beside the table.
  const notes = useNoteEditing();
  const [beingAdded, setBeingAdded] = useState<NewRecord>();
  // Each New starts a form afresh, with none of a discarded one's fields.
  const [forms, setForms] = useState(0);
  // The record just added, by Fathom's own ID, whose details show once People has it.
  const justAdded = useRef<string>(undefined);
  // The add being saved, so its outcome changes nothing once the form is closed or replaced.
  const submitted = useRef<NewRecord>(undefined);
  const shownId = useShownId(open, query.data?.people);
  const shownRecord = query.data?.people.find(({ id }) => id === shownId);
  const note = notes.note(beingAdded === undefined ? shownId : newRecordId);
  const question = useDiscardQuestion();
  // What showing another record, or adding one, would discard, if anything: a note changed, or a
  // record being added that holds something.
  const leaving = () =>
    notes.changing
      ? noteQuestion
      : beingAdded !== undefined && entered(beingAdded)
        ? recordQuestion(beingAdded.kind)
        : undefined;
  const leave = (go: () => void) => {
    question.ask(leaving(), () => {
      notes.discard();
      submitted.current = undefined;
      setBeingAdded(undefined);
      go();
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
      ({ id }) => id === justAdded.current && !isPending({ id }),
    );
    if (added === undefined) return;
    justAdded.current = undefined;
    onOpen?.(added.employeeId, true);
  }, [query.data, onOpen]);
  const { save, undoable, done } = useSaving<PeopleData>({
    queryKey: peopleQuery.queryKey,
    removed: "Someone else has removed this. The people have been refreshed.",
    blocked: opened || namingOpened || deciding,
  });

  // A row by name, as menus and notices name it, once the lists, which a row's actions wait for,
  // are loaded.
  const nameOf = (row: Person) =>
    isHire(row)
      ? `the planned hire ${rowName(row, lists.data as List[])}`
      : row.preferredName;

  const actions: PeopleActions = {
    decide: (asking, chosen, naming) => {
      // Approving names the drafts the choice uses, and rejecting those that use it.
      // Drafts are only decided once the people and lists are loaded.
      const { fields, orderDraft, people } = query.data as PeopleData;
      setDecision(
        decisionFor(
          asking,
          chosen,
          approves,
          lists.data as List[],
          { fields, orderDraft, people },
          naming,
        ),
      );
      setDeciding(true);
    },
    discardColumn: (target, name) => {
      save({
        next: (data) => data,
        save: () => discardColumnDraft(target),
        failure: `Fathom could not discard the draft of ${name}.`,
        onSaved: (changeSetId, before) => {
          done(`Discarded the draft of ${name}.`, changeSetId, before);
        },
      });
    },
    resubmitColumn: (target) => {
      save({
        next: (data) => data,
        save: () => resubmitColumnDraft(target),
        failure: "Fathom could not send the draft for approval again.",
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before);
        },
      });
    },
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
    update: (person, change) => {
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
          people: data.people.map((other) => {
            if (other.id !== person.id || other.draft === undefined) {
              return other;
            }
            const draft = { ...other.draft, state: "waiting" as const };
            delete draft.reason;
            return { ...other, draft };
          }),
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
    moveColumn: (key, label, after) => {
      save({
        next: (data) => ({ ...data, order: reordered(data.order, key, after) }),
        save: () => moveColumn(key, after),
        failure: `Fathom could not move ${label}.`,
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before);
        },
      });
    },
    editColumn: (field) => {
      setDialog({ kind: "edit", field });
      setOpened(true);
    },
  };

  // The dialog saved the column itself, so the page shows it at once, then reloads the people once
  // no other change is saving.
  const saved = (field: Field, changeSetId: string | null) => {
    setOpened(false);
    save({
      next: (data) => ({
        ...data,
        fields: data.fields.some((other) => other.id === field.id)
          ? data.fields.map((other) => (other.id === field.id ? field : other))
          : [...data.fields, field],
        order: data.order.includes(field.id)
          ? data.order
          : [...data.order, field.id],
      }),
      save: () => Promise.resolve(changeSetId),
      failure: "",
      onSaved: (_saved, before) => {
        undoable(changeSetId, before, newColumnId);
      },
    });
  };

  const removeColumn = (field: Field) => {
    setOpened(false);
    save({
      next: (data) => ({
        ...data,
        fields: data.fields.filter((other) => other.id !== field.id),
      }),
      save: () => deleteField(field.id),
      failure: `Fathom could not delete ${field.name}.`,
      onSaved: (changeSetId, before) => {
        done(`Deleted the ${field.name} column.`, changeSetId, before);
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
  });

  // The dialog saved the view itself, so the page shows it at once. A new view is then the one
  // applied.
  const named = ({ view: saved, changeSetId }: SavedViewResult) => {
    setNamingOpened(false);
    save({
      next: (data) => ({ ...data, views: withView(data.views, saved) }),
      save: () => Promise.resolve(changeSetId),
      failure: "",
      onSaved: (_saved, before) => {
        undoable(changeSetId, before);
      },
    });
    if (naming?.saved === undefined && naming) {
      onApply(naming.view, saved.id, true);
    }
  };

  let content: ReactNode;
  if (query.isPending || lists.isPending) {
    content = <Loader role="status" aria-label="Loading" />;
  } else if (query.isError || lists.isError) {
    content = (
      <Alert color="red" role="alert">
        <Group justify="space-between">
          <Text fz="sm">Fathom could not load the people.</Text>
          <Button
            size="compact-sm"
            variant="light"
            color="red"
            onClick={() => {
              void query.refetch();
              void lists.refetch();
            }}
          >
            Try again
          </Button>
        </Group>
      </Alert>
    );
  } else if (query.data.people.length === 0 && !canEdit) {
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
          onOpen={
            onOpen &&
            ((person) => {
              showRecord(person.employeeId);
            })
          }
          panels={[
            ...(beingAdded === undefined
              ? []
              : [
                  {
                    key: "person",
                    id: personPanelId,
                    name: "details",
                    node: (
                      <NewRecordPanel
                        key={forms}
                        record={beingAdded}
                        onRecord={setBeingAdded}
                        people={query.data.people}
                        fields={query.data.fields}
                        lists={lists.data}
                        order={query.data.order}
                        showDates={showDates}
                        showHireDates={showHireDates}
                        showPosition={!positionHidden}
                        canAddHires={canEditHires}
                        narrow={narrow}
                        notes={notes}
                        onAdd={(request) => {
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
                              justAdded.current = saved;
                            },
                            () => {
                              if (submitted.current !== saving) return;
                              submitted.current = undefined;
                              setBeingAdded({ ...saving, saving: false });
                            },
                          );
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
                        employeeId={open}
                        show={view.show}
                        showDates={showDates}
                        showHireDates={showHireDates}
                        canEditHires={canEditHires}
                        seesChart={seesChart}
                        narrow={narrow}
                        elsewhere={(person) =>
                          seesChart &&
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
                        onChange={canEdit ? actions.update : undefined}
                        notes={notes}
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
          orderDraft={query.data.orderDraft}
          orderHeldBy={query.data.orderHeldBy}
          lists={lists.data}
          canEdit={canEdit}
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
              save={(name) =>
                naming.saved
                  ? updateView(naming.saved.id, { name })
                  : createView({ name, definition: savedFor(naming.view) })
              }
              onSaved={named}
              onCancel={() => {
                setNamingOpened(false);
              }}
              onBusy={setBusy}
            />
          )}
        </Modal>
        <Modal
          opened={opened}
          onClose={() => {
            setOpened(false);
          }}
          closeOnEscape={!busy}
          closeOnClickOutside={!busy}
          withCloseButton={!busy}
          title={dialog?.kind === "edit" ? "Edit column" : "New column"}
        >
          {dialog && (
            <ColumnDialog
              {...(dialog.kind === "edit" ? { field: dialog.field } : {})}
              fields={query.data.fields}
              lists={lists.data}
              onSaved={saved}
              onDelete={removeColumn}
              onCancel={() => {
                setOpened(false);
              }}
              onBusy={setBusy}
            />
          )}
        </Modal>
      </>
    );
  }

  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader
        title="People"
        action={
          (canEdit || canEditColumns) && (
            <Group gap="xs">
              {canEditColumns && (
                <Button
                  id={newColumnId}
                  variant={canEdit ? "default" : "filled"}
                  onClick={() => {
                    setDialog({ kind: "new" });
                    setOpened(true);
                  }}
                >
                  New column
                </Button>
              )}
              {/* The live people alone are read only. */}
              {canEdit && view.show !== "live" && (
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
      {canEdit && positionHidden && (
        <Text size="sm" c="dimmed" id={cannotAddId}>
          You can't add people, since your role doesn't let you see positions.
        </Text>
      )}
      {content}
    </Stack>
  );
}
