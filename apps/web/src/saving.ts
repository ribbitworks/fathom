// SPDX-License-Identifier: Apache-2.0

// Saving changes on a page whose data is loaded as one query, such as the lists or the people. Every
// change shows at once and saves in the background, one at a time in the order made. The latest
// change can be undone with Cmd+Z or Ctrl+Z, or from its notification when it took something out of
// view, taking back with it any change joined to it, such as a new record's link.

import type { QueryKey } from "@tanstack/react-query";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import {
  ApiError,
  describeProblem,
  type Refusal,
  refusalOf,
  sendJsonFor,
} from "./api.ts";
import { focusSoon } from "./focus.ts";
import {
  changeMade,
  closeUndoNotice,
  isLatestChange,
  notifyFailure,
  notifySuccess,
  notifyUndoable,
} from "./notices.tsx";
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
  // Shows the server's refusal of a value under its field, in place of a notification, saying
  // whether it could: false when the field isn't shown.
  onRefused?: ((refusal: Refusal) => boolean) | undefined;
}

// What an Undo takes back: the change sets, oldest first, the data before the first, and the change
// it was offered for, by its count.
interface Taken<Data> {
  made: number;
  changeSetIds: readonly string[];
  before: Data;
}

// Fields that are typed in and keep their own undo, the note editor among them.
const typedField = [
  "textarea",
  "input:not([type])",
  ...["text", "search", "email", "url", "tel", "password", "number"].map(
    (type) => `input[type="${type}"]`,
  ),
  '[contenteditable]:not([contenteditable="false"])',
].join(", ");

// Whether the key press is in a field with something typed in it, whose own undo takes Cmd+Z. An
// empty one leaves Cmd+Z to the page, so a change made from it, such as adding a choice, can be
// undone without leaving it.
function inTypedText(target: EventTarget | null): boolean {
  if (!(target instanceof Element) || !target.matches(typedField)) {
    return false;
  }
  const text =
    target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement
      ? target.value
      : target.textContent;
  return text !== "";
}

// Whether a key press asks to undo the latest change, rather than the typing in a field. A field
// that handles the keys itself, such as the note editor, has already undone its typing, so may be
// empty by the time the page hears them.
export function isUndo(event: KeyboardEvent): boolean {
  return (
    !event.defaultPrevented &&
    (event.metaKey || event.ctrlKey) &&
    !event.shiftKey &&
    event.key.toLowerCase() === "z" &&
    !inTypedText(event.target)
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
  refreshes = [],
}: {
  queryKey: QueryKey;
  // Other data the changes alter, reloaded with it, such as the org chart drawn from the people.
  refreshes?: readonly QueryKey[];
  // What to say when something changed has been removed by someone else.
  removed: string;
  blocked: boolean;
}) {
  const queryClient = useQueryClient();
  const changeKey = [...queryKey, "change"];
  // The latest change's undo, with the change's count, which is undone only while no change has
  // been made since, here or elsewhere on the page.
  const [undo, setUndo] = useState<{ run: () => void; change: number }>();

  // The count of the change saved last, as made, so only the latest change made can be undone, even
  // when an earlier one finishes saving after it.
  const savedLast = useRef(0);
  // The change saving now, which a change made while it saves can join.
  const saving = useRef(0);
  // The change the next change made joins, and the one the change saved last joined, by count. A
  // change joins only the Undo offered for that change, never one offered since.
  const joining = useRef<number>(undefined);
  const savedJoins = useRef<number>(undefined);

  const change = useMutation({
    mutationKey: changeKey,
    scope: { id: JSON.stringify(queryKey) },
    mutationFn: ({
      save,
      made,
    }: Change<Data> & { made: number; joins?: number | undefined }) => {
      saving.current = made;
      return save();
    },
    onMutate: async ({ next }) => {
      await queryClient.cancelQueries({ queryKey });
      const before = queryClient.getQueryData(queryKey) as Data;
      queryClient.setQueryData(queryKey, next(before));
      return { before };
    },
    onError: (error, { failure, onFailed, onRefused }, context) => {
      queryClient.setQueryData(queryKey, (context as { before: Data }).before);
      onFailed?.();
      const refusal = refusalOf(error);
      if (refusal !== undefined && onRefused?.(refusal) === true) return;
      notifyFailure(
        error instanceof ApiError && error.status === notFound
          ? removed
          : describeProblem(error, failure),
      );
    },
    onSuccess: (changeSetId, { onSaved, made, joins }, context) => {
      savedLast.current = made;
      savedJoins.current = joins;
      onSaved?.(changeSetId, context.before);
    },
    onSettled: async () => {
      if (queryClient.isMutating({ mutationKey: changeKey }) > 1) return;
      // Every change is the user's own until they publish it, so their count of changes moves too.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey }),
        queryClient.invalidateQueries({ queryKey: unpublishedQuery.queryKey }),
        ...refreshes.map((key) =>
          queryClient.invalidateQueries({ queryKey: key }),
        ),
      ]);
    },
  });

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (
        undo === undefined ||
        blocked ||
        !isUndo(event) ||
        !isLatestChange(undo.change)
      ) {
        return;
      }
      event.preventDefault();
      undo.run();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
    };
  }, [undo, blocked]);

  const offered = useRef<Taken<Data>>(undefined);

  // Undoes saved change sets, the latest first, showing the data as it was before them at once. If
  // one can't be undone, Undo is offered again for it and those before it.
  const revert = (
    taken: Taken<Data>,
    focus?: string,
    onUndone?: () => void,
  ) => {
    const left = [...taken.changeSetIds];
    const made = changeMade();
    change.mutate({
      made,
      next: () => taken.before,
      save: async () => {
        let undid: string | null = null;
        for (const changeSetId of [...left].reverse()) {
          undid = await undoChange(changeSetId);
          left.pop();
        }
        return undid;
      },
      failure: undoFailure,
      onFailed: () => {
        offerTaken({ ...taken, made, changeSetIds: left }, focus, onUndone);
      },
      ...(onUndone ? { onSaved: onUndone } : {}),
    });
  };

  const offerTaken = (
    taken: Taken<Data>,
    focus?: string,
    onUndone?: () => void,
  ): (() => void) => {
    offered.current = taken;
    const run = () => {
      setUndo(undefined);
      offered.current = undefined;
      revert(taken, focus, onUndone);
      if (focus !== undefined) focusSoon(focus);
    };
    setUndo({ run, change: taken.made });
    return run;
  };

  // Makes a saved change set undoable until the next change, putting focus on what the undo
  // changes, and returns the undo. A newer change closes an older change's notification.
  const offer = (
    changeSetId: string,
    before: Data,
    focus?: string,
    onUndone?: () => void,
  ): (() => void) => {
    const made = savedLast.current;
    if (isLatestChange(made)) closeUndoNotice();
    const joined =
      savedJoins.current !== undefined &&
      offered.current?.made === savedJoins.current
        ? offered.current
        : undefined;
    return offerTaken(
      {
        made,
        changeSetIds: [...(joined?.changeSetIds ?? []), changeSetId],
        before: joined?.before ?? before,
      },
      focus,
      onUndone,
    );
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
      offered.current = undefined;
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
    const undo = offer(changeSetId, before, focus, onUndone);
    // A change made since has its own Undo, so this one only says what was done.
    if (isLatestChange(savedLast.current)) notifyUndoable(message, undo);
    else notifySuccess(message);
  };

  return {
    save: (next: Change<Data>) => {
      change.mutate({ ...next, made: changeMade(), joins: joining.current });
      joining.current = undefined;
    },
    // Joins the next change made to the change saving now, as a link made while its record saves,
    // so one Undo takes back both.
    joinNext: () => {
      joining.current = saving.current;
    },
    // A change a dialog already saved, in the change set given, if any: shown at once, then
    // reloaded once no other change is saving.
    shown: (
      next: Change<Data>["next"],
      changeSetId: string | null = null,
      onSaved?: Change<Data>["onSaved"],
    ) => {
      change.mutate({
        next,
        save: () => Promise.resolve(changeSetId),
        failure: "",
        ...(onSaved ? { onSaved } : {}),
        made: changeMade(),
      });
    },
    undoable,
    done,
  };
}

// What a page's saving gives the actions on its records.
export type RecordSaving<Data> = Pick<
  ReturnType<typeof useSaving<Data>>,
  "save" | "undoable" | "done"
>;
