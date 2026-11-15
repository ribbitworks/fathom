// SPDX-License-Identifier: Apache-2.0

// A table's saved views, through the server's API, for every page that has them: read once beside
// the page's records, and saved, renamed, updated, shared or taken back, and deleted, each change
// shown at once. Cmd+Z or Ctrl+Z undoes the latest, except for a view its maker can no longer use,
// whose history holds what their role can't see, so deleting one asks first.

import {
  changeSetIdSchema,
  type ListedView,
  listedViewSchema,
  savedSchema,
  type SavedView,
  type SavedViewChange,
  type SavedViewRequest,
  type UnusableView,
  type ViewTable,
} from "@fathom/shared";
import { Button, Group, Modal, Stack, Text } from "@mantine/core";
import { type QueryKey, queryOptions, useQuery } from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { z } from "zod";
import { getJson, sendDeleteFor, sendJsonFor } from "./api.ts";
import { notifySuccess } from "./notices.tsx";
import { useSaving } from "./saving.ts";
import {
  type SavedViews,
  type ViewPart,
  viewScopes,
} from "./table-controls.tsx";
import { savedFor, type View } from "./table-view.ts";
import {
  type NamedView,
  type SavedViewResult,
  ViewDialog,
} from "./view-dialog.tsx";

const viewsPath = (table: ViewTable) => `/api/views/${table}`;
const viewPath = (table: ViewTable, id: string) =>
  `${viewsPath(table)}/${encodeURIComponent(id)}`;
const viewResponse = z.object({
  view: listedViewSchema,
  changeSetId: changeSetIdSchema,
});

// A table's views, under the key of the page's records, so whatever reloads them, such as an
// approval or a change of class, reloads the views too.
const viewsQuery = (table: ViewTable, within: QueryKey) =>
  queryOptions({
    queryKey: [...within, "views", table],
    queryFn: () => getJson(viewsPath(table), z.array(listedViewSchema)),
  });

const isUsable = (view: ListedView): view is SavedView => "definition" in view;

const isUnusable = (view: ListedView): view is UnusableView => !isUsable(view);

async function createView(
  table: ViewTable,
  request: SavedViewRequest,
): Promise<SavedViewResult> {
  return sendJsonFor("POST", viewsPath(table), request, viewResponse);
}

// Renames a saved view, saves a new view over it, shares it or takes it back, or any of these.
async function updateView(
  table: ViewTable,
  id: string,
  change: SavedViewChange,
): Promise<SavedViewResult> {
  return sendJsonFor("PUT", viewPath(table, id), change, viewResponse);
}

async function deleteView(
  table: ViewTable,
  id: string,
): Promise<string | null> {
  return (await sendDeleteFor(viewPath(table, id), savedSchema)).changeSetId;
}

// The views with one added or replaced.
function withView(
  views: readonly ListedView[],
  saved: ListedView,
): ListedView[] {
  return views.some((other) => other.id === saved.id)
    ? views.map((other) => (other.id === saved.id ? saved : other))
    : [...views, saved];
}

// A view as the naming dialog checks a name against it, one that can't be used being personal.
const nameable = (view: ListedView): NamedView => ({
  id: view.id,
  name: view.name,
  scope: isUsable(view) ? view.scope : "personal",
});

// Naming a saved view: a new one for the view shown, with what saving it keeps, or one to rename.
type Naming =
  | { view: View; parts: readonly ViewPart[] }
  | { renaming: SavedView | UnusableView };

export function useSavedViews({
  table,
  within,
  applied,
  onApply,
  canShare,
  blocked = false,
}: {
  table: ViewTable;
  // The key of the page's records.
  within: QueryKey;
  // The saved view the page's view started from, as its address names it.
  applied: string | undefined;
  onApply: (view: View, id: string, replace?: boolean) => void;
  canShare: boolean;
  // While another of the page's dialogs is open, which Cmd+Z leaves alone.
  blocked?: boolean;
}): { saved: SavedViews; dialogs: ReactNode; opened: boolean } {
  const query = viewsQuery(table, within);
  // Until the views load, the page offers none, and a view's name is checked against none.
  const listed = useQuery(query).data ?? [];
  const [naming, setNaming] = useState<Naming>();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  // Like the naming dialog, the view being deleted stays set while its dialog closes.
  const [deleting, setDeleting] = useState<UnusableView>();
  const [deleteOpened, setDeleteOpened] = useState(false);
  const changes = useSaving<ListedView[]>({
    queryKey: query.queryKey,
    removed:
      "Someone else has removed this view. The views have been refreshed.",
    blocked: blocked || opened || deleteOpened,
  });

  const saved: SavedViews = {
    views: listed.filter(isUsable),
    unusable: listed.filter(isUnusable),
    applied,
    onApply: (shown, id) => {
      onApply(shown, id);
    },
    onSave: (shown, parts) => {
      setNaming({ view: shown, parts });
      setOpened(true);
    },
    onRename: (view) => {
      setNaming({ renaming: view });
      setOpened(true);
    },
    onUpdate: (view, shown) => {
      const definition = savedFor(shown);
      changes.save({
        next: (data) => withView(data, { ...view, definition }),
        save: async () =>
          (await updateView(table, view.id, { definition })).changeSetId,
        failure: `Fathom could not update ${view.name}.`,
        onSaved: (changeSetId, before) => {
          changes.undoable(changeSetId, before);
        },
      });
    },
    onDelete: (view) => {
      changes.save({
        next: (data) => data.filter((other) => other.id !== view.id),
        save: () => deleteView(table, view.id),
        failure: `Fathom could not delete ${view.name}.`,
        onSaved: (changeSetId, before) => {
          changes.done(`Deleted the ${view.name} view.`, changeSetId, before);
        },
      });
    },
    onDeleteUnusable: (view) => {
      setDeleting(view);
      setDeleteOpened(true);
    },
    onScope: (view, scope) => {
      changes.save({
        next: (data) => withView(data, { ...view, scope }),
        save: async () =>
          (await updateView(table, view.id, { scope })).changeSetId,
        failure: `Fathom could not change ${view.name}.`,
        onSaved: (changeSetId, before) => {
          changes.done(
            `${viewScopes[view.scope].changedVerb} the ${view.name} view.`,
            changeSetId,
            before,
          );
        },
      });
    },
  };

  // The dialog saved the view itself, so the page shows it at once. A new view is then the one
  // applied. Renaming a view that can't be used can't be undone, nor anything before it.
  const named = ({ view, changeSetId }: SavedViewResult) => {
    setOpened(false);
    changes.shown(
      (data) => withView(data, view),
      changeSetId,
      (_saved, before) => {
        changes.undoable(isUsable(view) ? changeSetId : null, before);
      },
    );
    if (naming !== undefined && "view" in naming) {
      onApply(naming.view, view.id, true);
    }
  };

  const deleteUnusable = (view: UnusableView) => {
    setDeleteOpened(false);
    changes.save({
      next: (data) => data.filter((other) => other.id !== view.id),
      save: () => deleteView(table, view.id),
      failure: `Fathom could not delete ${view.name}.`,
      onSaved: (_changeSetId, before) => {
        changes.undoable(null, before);
        notifySuccess(`Deleted the ${view.name} view.`);
      },
    });
  };

  const dialogs = (
    <>
      <Modal
        opened={opened}
        onClose={() => {
          setOpened(false);
        }}
        closeOnEscape={!busy}
        closeOnClickOutside={!busy}
        withCloseButton={!busy}
        title={
          naming !== undefined && "renaming" in naming
            ? "Rename view"
            : "Save view"
        }
      >
        {naming && (
          <ViewDialog
            {...("renaming" in naming
              ? { view: nameable(naming.renaming) }
              : { canSaveShared: canShare, saves: naming.parts })}
            views={listed.map(nameable)}
            save={(name, scope) =>
              "renaming" in naming
                ? updateView(table, naming.renaming.id, { name })
                : createView(table, {
                    name,
                    scope,
                    definition: savedFor(naming.view),
                  })
            }
            onSaved={named}
            onCancel={() => {
              setOpened(false);
            }}
            onBusy={setBusy}
          />
        )}
      </Modal>
      <Modal
        opened={deleteOpened}
        onClose={() => {
          setDeleteOpened(false);
        }}
        title={`Delete the ${deleting?.name ?? ""} view?`}
      >
        {deleting && (
          <Stack gap="md">
            <Text fz="sm">This can't be undone.</Text>
            <Group gap="xs" justify="flex-end">
              <Button
                variant="default"
                data-autofocus
                onClick={() => {
                  setDeleteOpened(false);
                }}
              >
                Cancel
              </Button>
              <Button
                color="red"
                onClick={() => {
                  deleteUnusable(deleting);
                }}
              >
                Delete
              </Button>
            </Group>
          </Stack>
        )}
      </Modal>
    </>
  );

  return { saved, dialogs, opened: opened || deleteOpened };
}
