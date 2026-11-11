// SPDX-License-Identifier: Apache-2.0

// The user's unpublished changes, which only they see until they publish them, all at once, as the
// Decisions Log sets out: a count in the top bar, shown while there are any, with Publish, and a menu
// listing them with Discard all. Publishing or discarding reloads every page's data, since either
// changes what others, and the user, see.

import {
  type Unpublished,
  unpublishedDoneSchema,
  unpublishedSchema,
} from "@fathom/shared";
import {
  ActionIcon,
  Button,
  Group,
  Menu,
  Modal,
  Stack,
  Text,
} from "@mantine/core";
import {
  queryOptions,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { describeProblem, getJson, sendJsonFor } from "./api.ts";
import { AppMenu } from "./app-menu.tsx";
import { MenuTitle, UnpublishedNote } from "./draft-details.tsx";
import { Icon } from "./icons.tsx";
import { notifyFailure, notifySuccess } from "./notices.tsx";
import { count } from "./numbers.ts";
import { type Phrase, PhraseText } from "./phrase.tsx";

export const unpublishedQuery = queryOptions({
  queryKey: ["unpublished"],
  queryFn: () => getJson("/api/unpublished", unpublishedSchema),
});

// The most changes the menu names; the rest are counted.
const named = 10;

export const changeCount = (total: number) =>
  total === 1 ? "1 change" : `${count(total)} changes`;

const verbs = new Map([
  ["created", "Added"],
  ["changed", "Changed"],
  ["deleted", "Removed"],
]);

const newOrder = "the new order for ";

// A change in words, as a record's menu puts its draft: what was done, in semibold, then to what. A
// change without an action is a new order.
function changeWords({
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

export function UnpublishedControl() {
  const queryClient = useQueryClient();
  const unpublished = useQuery(unpublishedQuery);
  const [discarding, setDiscarding] = useState(false);
  const done = (verb: string) => async (result: { total: number }) => {
    setDiscarding(false);
    notifySuccess(`${verb} ${changeCount(result.total)}.`);
    await queryClient.invalidateQueries();
  };
  const publish = useMutation({
    mutationFn: () =>
      sendJsonFor(
        "POST",
        "/api/unpublished/publish",
        {},
        unpublishedDoneSchema,
      ),
    onSuccess: done("Published"),
    onError: (error) => {
      notifyFailure(
        describeProblem(error, "Fathom could not publish the changes."),
      );
    },
  });
  const discard = useMutation({
    mutationFn: () =>
      sendJsonFor(
        "POST",
        "/api/unpublished/discard",
        {},
        unpublishedDoneSchema,
      ),
    onSuccess: done("Discarded"),
    onError: (error) => {
      notifyFailure(
        describeProblem(error, "Fathom could not discard the changes."),
      );
    },
  });
  const changes = unpublished.data?.changes ?? [];
  if (changes.length === 0) return null;
  const busy = publish.isPending || discard.isPending;
  const total = changeCount(changes.length);
  return (
    <Group gap={4} wrap="nowrap">
      <Button
        size="compact-sm"
        loading={publish.isPending}
        disabled={discard.isPending}
        onClick={() => {
          publish.mutate();
        }}
      >
        Publish {total}
      </Button>
      <AppMenu position="bottom-end" width={280} hideDetached={false}>
        <AppMenu.Target>
          <ActionIcon
            variant="subtle"
            color="gray"
            disabled={busy}
            aria-label="Unpublished changes"
          >
            <Icon name="more" />
          </ActionIcon>
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
      <Modal
        opened={discarding}
        onClose={() => {
          setDiscarding(false);
        }}
        title={`Discard ${total}?`}
        closeOnEscape={!discard.isPending}
        closeOnClickOutside={!discard.isPending}
        withCloseButton={!discard.isPending}
      >
        <Stack gap="md">
          <Text fz="sm">
            The unpublished changes are deleted. This cannot be undone.
          </Text>
          <Group justify="flex-end">
            <Button
              variant="default"
              disabled={discard.isPending}
              onClick={() => {
                setDiscarding(false);
              }}
            >
              Cancel
            </Button>
            <Button
              color="red"
              loading={discard.isPending}
              onClick={() => {
                discard.mutate();
              }}
            >
              Discard
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Group>
  );
}
