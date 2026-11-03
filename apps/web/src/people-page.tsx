// SPDX-License-Identifier: Apache-2.0

// The People page: everyone the user may see, in a table edited like a spreadsheet, with the columns
// people have added, each drawing on a list. Those who may change people add, edit, and delete them;
// those who may change planning configuration add, change, and delete columns, and move any column.
// Every change to a person is a draft, shown in place until an Approver approves it on the Drafts
// page. Every change shows at once and saves in the background, and the latest can be undone with Cmd+Z
// or Ctrl+Z, or from its notification when it took something out of view. What the table shows,
// its search, filters, and sort, is kept in the page address, and can be saved as a view shared with
// everyone who sees people.

import type {
  Field,
  List,
  Person,
  PersonChange,
  PersonDraft,
  PersonRequest,
  SavedView,
} from "@fathom/shared";
import {
  Alert,
  Button,
  Group,
  Loader,
  Modal,
  Paper,
  Stack,
  Text,
} from "@mantine/core";
import { useIsMutating, useQuery } from "@tanstack/react-query";
import { type ReactNode, useRef, useState } from "react";
import { ColumnDialog } from "./column-dialog.tsx";
import { DecisionModal } from "./decision-dialog.tsx";
import { listsQuery } from "./lists.ts";
import { PageHeader } from "./page-header.tsx";
import { type Decision, decisionFor } from "./drafts.ts";
import classes from "./pages.module.css";
import {
  columnsFor,
  draftColumn,
  type PeopleActions,
  PeopleGrid,
  type PeopleGridHandle,
} from "./people-grid.tsx";
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
  updatePerson,
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

// A person with a change applied, as the table shows it before it is saved.
function changed(person: Person, change: PersonChange): Person {
  const { values, preferredName, employeeId, ...dates } = change;
  return {
    ...person,
    ...dates,
    preferredName: preferredName ?? person.preferredName,
    employeeId: employeeId ?? person.employeeId,
    values: { ...person.values, ...values },
  };
}

// Someone being added, as the table shows them before they are saved: a draft adding them.
function adding(id: string, request: PersonRequest): Person {
  const { values, ...details } = request;
  return {
    id,
    ...details,
    values,
    draft: {
      action: "created",
      // A draft adding someone changes everything, so names nothing in particular.
      changed: [],
      live: { values: {} },
      state: "waiting",
      madeBy: null,
      madeAt: new Date().toISOString(),
    },
  };
}

// A person as they are live, without their draft.
function asLive(person: Person, draft: PersonDraft): Person {
  const { values, ...details } = draft.live;
  const live: Person = {
    ...person,
    ...(details as Partial<Person>),
    values: { ...person.values, ...values },
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
      live: { values: {} },
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

export function PeoplePage({
  canEdit,
  canApprove = false,
  canEditColumns,
  showDates,
  view,
  onView,
  applied,
  onApply,
}: {
  canEdit: boolean;
  canApprove?: boolean;
  canEditColumns: boolean;
  showDates: boolean;
  view: View;
  onView: ChangeView;
  // The saved view the view started from, and how to apply one, replacing the current address
  // rather than adding to its history when asked.
  applied: string | undefined;
  onApply: (view: View, id: string, replace?: boolean) => void;
}) {
  const query = useQuery(peopleQuery);
  const saving =
    useIsMutating({ mutationKey: [...peopleQuery.queryKey, "change"] }) > 0;
  const lists = useQuery(listsQuery);
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
  const grid = useRef<PeopleGridHandle>(null);
  const { save, undoable, done } = useSaving<PeopleData>({
    queryKey: peopleQuery.queryKey,
    removed: "Someone else has removed this. The people have been refreshed.",
    blocked: opened || namingOpened || deciding,
  });

  const actions: PeopleActions = {
    decide: (asking, chosen, naming) => {
      // Approving names the drafts the choice uses, and rejecting those that use it.
      // Drafts are only decided once the people and lists are loaded.
      const { fields, orderDraft } = query.data as PeopleData;
      setDecision(
        decisionFor(
          asking,
          chosen,
          lists.data as List[],
          { fields, orderDraft },
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
          const { ids, changeSetId } = await createPeople(
            added.map(({ request }) => request),
          );
          onAdded(ids);
          return changeSetId;
        },
        failure: "Fathom could not add the people. Try again in a moment.",
        onFailed,
        onSaved: (changeSetId, before) => {
          undoable(changeSetId, before);
        },
      });
    },
    update: (person, change) => {
      save({
        next: (data) => ({
          ...data,
          people: data.people.map((other) =>
            other.id === person.id ? changed(other, change) : other,
          ),
        }),
        save: () => updatePerson(person.id, change),
        failure: `Fathom could not save the change to ${person.preferredName}.`,
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
        save: () => deletePerson(person.id),
        failure: `Fathom could not remove ${person.preferredName}.`,
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
        save: () => resubmitDraft(person.id),
        failure: `Fathom could not send the draft of ${person.preferredName} for approval again.`,
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
        save: () => discardDraft(person.id),
        failure: `Fathom could not discard the draft of ${person.preferredName}.`,
        onSaved: (changeSetId, before) => {
          if (gone) {
            done(
              `Discarded the draft adding ${person.preferredName}.`,
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
          people={query.data.people}
          fields={query.data.fields}
          order={query.data.order}
          orderDraft={query.data.orderDraft}
          lists={lists.data}
          canEdit={canEdit}
          canApprove={canApprove}
          saving={saving}
          canEditColumns={canEditColumns}
          showDates={showDates}
          actions={actions}
          view={view}
          onView={onView}
          saved={savedViews(query.data.views)}
          ref={grid}
        />
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
                  variant="filled"
                  disabled={!query.isSuccess || !lists.isSuccess}
                  onClick={() => {
                    grid.current?.addPerson();
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
