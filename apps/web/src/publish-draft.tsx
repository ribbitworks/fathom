// SPDX-License-Identifier: Apache-2.0

// Publishing the user's own draft of a record from the record's menu, and the question naming the
// changes that go with it, and which records the user's own unpublished changes take the published
// drafts back from.

import type { DraftsAsked, Unpublished } from "@fathom/shared";
import { Modal, Stack, Text } from "@mantine/core";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { type ReactNode, createContext, useContext } from "react";
import { describeProblem } from "./api.ts";
import { CountedList } from "./counted-list.tsx";
import { DialogActions, useDialogState } from "./dialog-actions.tsx";
import { notifyFailure } from "./notices.tsx";
import { PhraseText } from "./phrase.tsx";
import {
  changeCount,
  changeWords,
  unpublishedQuery,
  useUnpublishedActions,
} from "./unpublished.tsx";
import { askedAmong, publishedAlong, takesBack } from "./unpublished-links.ts";

// Publishes the draft asked for, with those that go with it.
export type PublishDraft = (asked: DraftsAsked) => void;

// Whether the drafts asked for are each the user's own unpublished taking back of a published draft.
export type TakesBack = (asked: DraftsAsked) => boolean;

const PublishDraftContext = createContext<PublishDraft | undefined>(undefined);
const TakesBackContext = createContext<TakesBack>(() => false);

// How the user's own draft is published from a record's menu, or none where it can't be.
export const usePublishDraft = () => useContext(PublishDraftContext);

export const useTakesBack = () => useContext(TakesBackContext);

const couldNotPublish = "Fathom could not publish the changes.";

interface Asking {
  asked: DraftsAsked;
  chosen: Unpublished["changes"];
  along: Unpublished["changes"];
}

const named = (changes: Unpublished["changes"]) =>
  changes.map((change) => ({
    key: change.key,
    name: <PhraseText phrase={changeWords(change)} />,
  }));

export function PublishDraftProvider({
  publishes,
  children,
}: {
  // Whether the user makes drafts, so has any to publish.
  publishes: boolean;
  children: ReactNode;
}) {
  const queryClient = useQueryClient();
  const question = useDialogState<Asking>();
  const { publish } = useUnpublishedActions(question.close);
  const unpublished = useQuery({ ...unpublishedQuery, enabled: publishes });
  const changes = unpublished.data?.changes ?? [];
  const asksTakeBack: TakesBack = (asked) => takesBack(changes, asked);
  const publishDraft: PublishDraft = (asked) => {
    // Read afresh, since what goes along must be what the server publishes now.
    queryClient.query(unpublishedQuery).then(
      ({ changes }) => {
        const along = publishedAlong(changes, asked);
        if (along.length === 0) publish.mutate(asked);
        else
          question.open({ asked, chosen: askedAmong(changes, asked), along });
      },
      (error: unknown) => {
        notifyFailure(describeProblem(error, couldNotPublish));
      },
    );
  };
  const asking = question.dialog;
  const along = asking?.along ?? [];
  return (
    <PublishDraftContext.Provider value={publishes ? publishDraft : undefined}>
      <TakesBackContext.Provider value={asksTakeBack}>
        {children}
      </TakesBackContext.Provider>
      <Modal
        opened={question.opened}
        onClose={question.close}
        closeOnEscape={!publish.isPending}
        closeOnClickOutside={!publish.isPending}
        withCloseButton={!publish.isPending}
        title={`Publish ${changeCount(along.length + 1)}?`}
      >
        {asking !== undefined && (
          <form
            noValidate
            onSubmit={(event) => {
              event.preventDefault();
              publish.mutate(asking.asked);
            }}
          >
            <Stack gap="md">
              <CountedList items={named(asking.chosen)} />
              <div>
                <Text fz="sm">Also publishes the changes it goes with:</Text>
                <CountedList items={named(along)} mt={4} />
              </div>
              <DialogActions
                error={null}
                pending={publish.isPending}
                label="Publish"
                onCancel={question.close}
              />
            </Stack>
          </form>
        )}
      </Modal>
    </PublishDraftContext.Provider>
  );
}
