// SPDX-License-Identifier: Apache-2.0

// The user's unpublished changes: the top bar's Publish and its menu, and publishing or discarding
// the changes chosen on the Drafts page.

import {
  type DraftsAsked,
  type Unpublished,
  unpublishedDoneSchema,
  type UnpublishedPublished,
  unpublishedPublishedSchema,
  unpublishedSchema,
} from "@fathom/shared";
import { Button, Group, Menu, Modal, Stack, Text } from "@mantine/core";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { type ReactNode, useState } from "react";
import { describeProblem, getJson, sendJsonFor } from "./api.ts";
import { AppMenu } from "./app-menu.tsx";
import { MenuTitle, UnpublishedNote } from "./draft-details.tsx";
import { notifyFailure, notifySuccess } from "./notices.tsx";
import { count } from "./numbers.ts";
import { type Phrase, PhraseText } from "./phrase.tsx";
import { MoreButton } from "./row-controls.tsx";

export const unpublishedQuery = queryOptions({
  queryKey: ["unpublished"],
  queryFn: () => getJson("/api/unpublished", unpublishedSchema),
});

// The most changes the menu names; the rest are counted.
const named = 10;

export const changeCount = (total: number) =>
  total === 1 ? "1 change" : `${count(total)} changes`;

// What publishing did, as its notification says, with the changes it left since the acting role
// may not make them.
function publishedWords({ total, left }: UnpublishedPublished): string {
  if (left === 0) return `Published ${changeCount(total)}.`;
  if (total === 0) {
    return `Nothing was published. ${left === 1 ? "1 change needs" : `${count(left)} changes need`} another role.`;
  }
  return `Published ${changeCount(total)}. ${left === 1 ? "1 needs" : `${count(left)} need`} another role.`;
}

const verbs = new Map([
  ["created", "Added"],
  ["changed", "Changed"],
  ["deleted", "Removed"],
]);

const newOrder = "the new order for ";

// A change in words, as a record's menu puts its draft: what was done, in semibold, then to what. A
// change without an action is a new order.
export function changeWords({
  subject,
  action,
  discarded,
}: Unpublished["changes"][number]): Phrase {
  const order = subject.startsWith(newOrder);
  if (discarded === true) {
    return [
      { strong: "Discarded" },
      order ? ` ${subject}` : ` the draft of ${subject}`,
    ];
  }
  const verb = action === undefined ? undefined : verbs.get(action);
  if (verb !== undefined) return [{ strong: verb }, ` ${subject}`];
  return [{ strong: "Reordered" }, ` ${subject.slice(newOrder.length)}`];
}

// Publishing and discarding the user's changes: every one, or those chosen, with those that go with
// them, which the server adds. Each says how many it took in a notification, and publishing how
// many it left for another role.
export function useUnpublishedActions(onDone: () => void) {
  const queryClient = useQueryClient();
  const finished = async (notify: () => void) => {
    onDone();
    notify();
    await queryClient.invalidateQueries();
  };
  const asked = (drafts?: DraftsAsked) =>
    drafts === undefined ? {} : { drafts };
  const publish = useMutation({
    mutationFn: (drafts?: DraftsAsked) =>
      sendJsonFor(
        "POST",
        "/api/unpublished/publish",
        asked(drafts),
        unpublishedPublishedSchema,
      ),
    onSuccess: (result) =>
      finished(() => {
        // Nothing published is a refusal, kept in view until closed.
        (result.total === 0 && result.left > 0 ? notifyFailure : notifySuccess)(
          publishedWords(result),
        );
      }),
    onError: (error) => {
      notifyFailure(
        describeProblem(error, "Fathom could not publish the changes."),
      );
    },
  });
  const discard = useMutation({
    mutationFn: (drafts?: DraftsAsked) =>
      sendJsonFor(
        "POST",
        "/api/unpublished/discard",
        asked(drafts),
        unpublishedDoneSchema,
      ),
    onSuccess: (result) =>
      finished(() => {
        notifySuccess(`Discarded ${changeCount(result.total)}.`);
      }),
    onError: (error) => {
      notifyFailure(
        describeProblem(error, "Fathom could not discard the changes."),
      );
    },
  });
  return { publish, discard, busy: publish.isPending || discard.isPending };
}

// Asks before discarding changes, which cannot be undone.
export function DiscardChangesModal({
  opened,
  total,
  pending,
  onCancel,
  onDiscard,
  children,
}: {
  opened: boolean;
  // Such as "3 changes".
  total: string;
  pending: boolean;
  onCancel: () => void;
  onDiscard: () => void;
  // What is discarded, ending with "This cannot be undone."
  children: ReactNode;
}) {
  return (
    <Modal
      opened={opened}
      onClose={onCancel}
      title={`Discard ${total}?`}
      closeOnEscape={!pending}
      closeOnClickOutside={!pending}
      withCloseButton={!pending}
    >
      <Stack gap="md">
        <Text fz="sm">{children}</Text>
        <Group justify="flex-end">
          <Button variant="default" disabled={pending} onClick={onCancel}>
            Cancel
          </Button>
          <Button color="red" loading={pending} onClick={onDiscard}>
            Discard
          </Button>
        </Group>
      </Stack>
    </Modal>
  );
}

export function UnpublishedControl() {
  const unpublished = useQuery(unpublishedQuery);
  const [discarding, setDiscarding] = useState(false);
  const { publish, discard, busy } = useUnpublishedActions(() => {
    setDiscarding(false);
  });
  const changes = unpublished.data?.changes ?? [];
  if (changes.length === 0) return null;
  const total = changeCount(changes.length);
  return (
    <Group gap={4} wrap="nowrap">
      <Button
        size="compact-sm"
        loading={publish.isPending}
        disabled={discard.isPending}
        onClick={() => {
          publish.mutate(undefined);
        }}
      >
        Publish {total}
      </Button>
      <AppMenu position="bottom-end" width={280} hideDetached={false}>
        <AppMenu.Target>
          <MoreButton disabled={busy} label="Unpublished changes" />
        </AppMenu.Target>
        <AppMenu.Dropdown>
          <MenuTitle>Unpublished changes</MenuTitle>
          <UnpublishedNote />
          {changes.slice(0, named).map((change, index) => (
            // Two records can share a name, so their place names them.
            <Text
              key={`${String(index)} ${change.subject}`}
              fz="xs"
              px="sm"
              pb={4}
            >
              <PhraseText phrase={changeWords(change)} />
            </Text>
          ))}
          {changes.length > named && (
            <Text fz="xs" px="sm" pb={4} c="dimmed">
              and {count(changes.length - named)} more
            </Text>
          )}
          <Menu.Divider />
          <Menu.Item
            color="red"
            onClick={() => {
              setDiscarding(true);
            }}
          >
            Discard all…
          </Menu.Item>
        </AppMenu.Dropdown>
      </AppMenu>
      <DiscardChangesModal
        opened={discarding}
        total={total}
        pending={discard.isPending}
        onCancel={() => {
          setDiscarding(false);
        }}
        onDiscard={() => {
          discard.mutate(undefined);
        }}
      >
        The unpublished changes are discarded. This cannot be undone.
      </DiscardChangesModal>
    </Group>
  );
}
