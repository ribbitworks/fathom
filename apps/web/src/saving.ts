// SPDX-License-Identifier: Apache-2.0

// Saving changes on a page whose data is loaded as one query, such as the lists or the people. Every
// change shows at once and saves in the background, one at a time in the order made. The latest
// change can be undone with Cmd+Z or Ctrl+Z, or from its notification when it took something out of
// view. Undoing asks the server to undo the change set the change was saved in, in one request, and
// shows the data as it was just before the change straight away.

import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { ApiError, describeProblem, sendJsonFor } from "./api.ts";
import { focusSoon } from "./focus.ts";
import { closeUndoNotice, notifyFailure, notifyUndoable } from "./notices.tsx";
import { unpublishedQuery } from "./unpublished.tsx";
import { savedSchema } from "@fathom/shared";

const notFound = 404;
export const undoFailure =
  "Fathom could not undo the change. Try again in a moment.";

// Asks the server to undo a change set, and returns the change set that undid it.
export async function undoChange(changeSetId: string): Promise<string | null> {
  return (
    await sendJsonFor(
      "POST",
      `/api/undo/${encodeURIComponent(changeSetId)}`,
      {},
      savedSchema,
    )
  ).changeSetId;
}

// A change that shows at once and saves in the background: how the data will look, how to save it,
// returning the change set it was saved in, what to do once saved, and what to do if it fails.
export interface Change<Data> {
  next: (data: Data) => Data;
  save: () => Promise<string | null>;
  failure: string;
  // Given the change set, and the data as it was just before the change.
  onSaved?: (changeSetId: string | null, before: Data) => void;
  onFailed?: () => void;
}

// Whether a key press asks to undo the latest change. In a text field with something typed, it
// undoes the typing instead.
export function isUndo(event: KeyboardEvent): boolean {
  const target = event.target as HTMLInputElement;
  return (
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    event.key.toLowerCase() === "z" &&
    !(target.matches("input, textarea") && target.value !== "")
  );
}

// Changes to the data under one query key. A failed change goes back to the data as it was just
// before it, which briefly hides any later changes still waiting to save until the data is reloaded.
// The data is reloaded once no change is still saving, so rows do not flicker. Undo is offered for
// the latest saved change, from anywhere on the page but not while it is blocked, as behind a dialog.
export function useSaving<Data>({
  queryKey,
  removed,
  blocked,
}: {
  queryKey: QueryKey;
  // What to say when something changed has been removed by someone else.
  removed: string;
  blocked: boolean;
}) {
  const queryClient = useQueryClient();
  const changeKey = [...queryKey, "change"];
  const [undo, setUndo] = useState<() => void>();

  const change = useMutation({
    mutationKey: changeKey,
    scope: { id: JSON.stringify(queryKey) },
    mutationFn: ({ save }: Change<Data>) => save(),
    onMutate: async ({ next }) => {
      await queryClient.cancelQueries({ queryKey });
      const before = queryClient.getQueryData(queryKey) as Data;
      queryClient.setQueryData(queryKey, next(before));
      return { before };
    },
    onError: (error, { failure, onFailed }, context) => {
      queryClient.setQueryData(queryKey, (context as { before: Data }).before);
      onFailed?.();
      notifyFailure(
        error instanceof ApiError && error.status === notFound
          ? removed
          : describeProblem(error, failure),
      );
    },
    onSuccess: (changeSetId, { onSaved }, context) => {
      onSaved?.(changeSetId, context.before);
    },
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey: changeKey }) > 1) return;
      // Every change is the user's own until they publish it, so their count of changes moves too.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: unpublishedQuery.queryKey }),
      ]);
    },
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (undo === undefined || blocked || !isUndo(event)) return;
      event.preventDefault();
      undo();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [undo, blocked]);

  // Undoes a saved change set, showing the data as it was before it at once.
  const revert = (before: Data, changeSetId: string, onUndone?: () => void) => {
    change.mutate({
      next: () => before,
      save: () => undoChange(changeSetId),
      failure: undoFailure,
      ...(onUndone ? { onSaved: onUndone } : {}),
    });
  };

  // Makes a saved change set undoable until the next change, putting focus on what the undo
  // changes, and returns the undo. A newer change closes an older change's notification.
  const offer = (
    changeSetId: string,
    before: Data,
    focus?: string,
    onUndone?: () => void,
  ): (() => void) => {
    closeUndoNotice();
    const run = () => {
      setUndo(undefined);
      revert(before, changeSetId, onUndone);
      if (focus !== undefined) focusSoon(focus);
    };
    setUndo(() => run);
    return run;
  };

  // Offers Undo for a change, by Cmd+Z or Ctrl+Z. A change that saved nothing has nothing to undo,
  // and leaves nothing older to undo either.
  const undoable = (
    changeSetId: string | null,
    before: Data,
    focus?: string,
    onUndone?: () => void,
  ): void => {
    if (changeSetId === null) {
      closeUndoNotice();
      setUndo(undefined);
      return;
    }
    offer(changeSetId, before, focus, onUndone);
  };

  // Says what was done when it took something out of view, offering Undo there too. Changes seen in
  // place, such as an added or moved item, need no notification.
  const done = (
    message: string,
    changeSetId: string | null,
    before: Data,
    focus?: string,
    onUndone?: () => void,
  ) => {
    if (changeSetId === null) return;
    notifyUndoable(message, offer(changeSetId, before, focus, onUndone));
  };

  return {
    save: (next: Change<Data>) => {
      change.mutate(next);
    },
    undoable,
    done,
  };
}
