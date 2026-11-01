// SPDX-License-Identifier: Apache-2.0

// The People page: everyone the user may see, in a table edited like a spreadsheet, with the columns
// people have added, each drawing on a list. Those who may change people add, edit, and delete them;
// those who may change planning configuration add, change, and delete columns, and move any column.
// Every change shows at once and saves in the background, and the latest can be undone with Cmd+Z
// or Ctrl+Z, or from its notification when it took something out of view. What the table shows,
// its search, filters, and sort, is kept in the page address.

import type { Field, Person, PersonChange } from "@fathom/shared";
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
import { useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { ColumnDialog } from "./column-dialog.tsx";
import { listsQuery } from "./lists.ts";
import { PageHeader } from "./page-header.tsx";
import { type PeopleActions, PeopleGrid } from "./people-grid.tsx";
import {
  createPeople,
  deleteField,
  deletePerson,
  moveColumn,
  type PeopleData,
  peopleQuery,
  updatePerson,
} from "./people.ts";
import { useSaving } from "./saving.ts";
import type { ChangeView } from "./table-controls.tsx";
import type { View } from "./table-view.ts";

const newColumnId = "column-new";

type Dialog = { kind: "new" } | { kind: "edit"; field: Field };

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
  canEditColumns,
  showDates,
  view,
  onView,
}: {
  canEdit: boolean;
  canEditColumns: boolean;
  showDates: boolean;
  view: View;
  onView: ChangeView;
}) {
  const query = useQuery(peopleQuery);
  const lists = useQuery(listsQuery);
  // The dialog stays set while it closes, so its content does not vanish mid-animation.
  const [dialog, setDialog] = useState<Dialog>();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const { save, undoable, done } = useSaving<PeopleData>({
    queryKey: peopleQuery.queryKey,
    removed: "Someone else has removed this. The people have been refreshed.",
    blocked: opened,
  });

  const actions: PeopleActions = {
    add: (requests, onAdded, onFailed) => {
      save({
        next: (data) => data,
        save: async () => {
          const { ids, changeSetId } = await createPeople(requests);
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
    remove: (person) => {
      save({
        next: (data) => ({
          ...data,
          people: data.people.filter((other) => other.id !== person.id),
        }),
        save: () => deletePerson(person.id),
        failure: `Fathom could not delete ${person.preferredName}.`,
        onSaved: (changeSetId, before) => {
          done(`Deleted ${person.preferredName}.`, changeSetId, before);
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
          lists={lists.data}
          canEdit={canEdit}
          canEditColumns={canEditColumns}
          showDates={showDates}
          actions={actions}
          view={view}
          onView={onView}
        />
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
    <Stack gap="md">
      <PageHeader
        title="People"
        action={
          canEditColumns && (
            <Button
              id={newColumnId}
              onClick={() => {
                setDialog({ kind: "new" });
                setOpened(true);
              }}
            >
              New column
            </Button>
          )
        }
      />
      {content}
    </Stack>
  );
}
