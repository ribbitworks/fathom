// SPDX-License-Identifier: Apache-2.0

// Renaming and removing a page under Mine, with Undo. They're kept above every page, since removing
// the page that's open leaves it, and its Undo opens it again.

import type { ListedPrivatePage } from "@fathom/shared";
import { useNavigate } from "@tanstack/react-router";
import { createContext, type ReactNode, useContext } from "react";
import { useDialogState } from "./dialog-actions.tsx";
import { focusFoundSoon } from "./focus.ts";
import {
  landingAfter,
  privatePagesQuery,
  removePrivatePage,
} from "./private-pages.ts";
import {
  removalQuestion,
  removedWords,
  useRemovalQuestion,
} from "./removal-question.tsx";
import { RenamePageDialog } from "./rename-page-dialog.tsx";
import { useSaving } from "./saving.ts";

type Page = Pick<ListedPrivatePage, "id" | "name">;

interface MineChanges {
  // Each calls back to put focus where the change came from, once its dialog is left, or the page
  // renamed; removing the page lands elsewhere.
  rename: (page: Page, kept: () => void) => void;
  remove: (page: Page, kept: () => void) => void;
}

// Every page is drawn inside the provider, which the layout gives, so nothing is done without it.
const nothing = () => undefined;
const MineChangesContext = createContext<MineChanges>({
  rename: nothing,
  remove: nothing,
});

export const useMineChanges = () => useContext(MineChangesContext);

// The page landed on takes focus by its heading, so the next Tab starts from its top.
const focusHeading = () => {
  focusFoundSoon(
    () => document.querySelector<HTMLElement>("main h1") ?? undefined,
  );
};

export function MineChangesProvider({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  const question = useRemovalQuestion();
  const renaming = useDialogState<{ page: Page; kept: () => void }>();
  const changes = useSaving<ListedPrivatePage[]>({
    queryKey: privatePagesQuery.queryKey,
    removed: "This page was removed. Mine has been refreshed.",
    blocked: question.asking || renaming.opened,
  });
  const open = (pageId: string | undefined) => {
    void (
      pageId === undefined
        ? navigate({ to: "/" })
        : navigate({ to: "/mine/$pageId", params: { pageId } })
    ).then(focusHeading);
  };

  const remove = (page: Page, kept: () => void) => {
    const removed = { kind: "page", name: page.name };
    question.ask(
      removalQuestion(removed),
      () => {
        changes.save({
          next: (pages) => pages.filter(({ id }) => id !== page.id),
          save: async () => (await removePrivatePage(page.id)).changeSetId,
          failure: `Fathom could not remove ${page.name}.`,
          onFailed: kept,
          onSaved: (changeSetId, before) => {
            open(landingAfter(before, page.id));
            changes.done(
              removedWords(removed),
              changeSetId,
              before,
              undefined,
              () => {
                open(page.id);
              },
            );
          },
        });
      },
      kept,
    );
  };

  return (
    <MineChangesContext.Provider
      value={{
        rename: (page, kept) => {
          renaming.open({ page, kept });
        },
        remove,
      }}
    >
      {children}
      {question.dialog}
      <RenamePageDialog
        page={renaming.dialog?.page}
        opened={renaming.opened}
        onClose={() => {
          renaming.close();
          renaming.dialog?.kept();
        }}
        onRenamed={(renamed, changeSetId) => {
          renaming.close();
          renaming.dialog?.kept();
          changes.shown(
            (pages) =>
              pages.map((one) =>
                one.id === renamed.id ? { ...one, name: renamed.name } : one,
              ),
            changeSetId,
            changes.undoable,
          );
        }}
      />
    </MineChangesContext.Provider>
  );
}
