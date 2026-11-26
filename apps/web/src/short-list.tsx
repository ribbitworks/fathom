// SPDX-License-Identifier: Apache-2.0

// The records a record's details list, such as a release's features or a project's activities,
// with what can be done with them.

import { Button, Group, Stack, Text } from "@mantine/core";
import { FoldedList } from "./folded-list.tsx";
import { type RecordLinkItem, RecordLinkList } from "./record-details.tsx";

const shownFirst = 5;

export interface ShortListAction {
  label: string;
  onClick: () => void;
  // For a button focus goes back to, such as after a form it opened closes.
  id?: string;
}

export function ShortList({
  items,
  noun,
  onShow,
  actions,
}: {
  items: readonly (Pick<RecordLinkItem, "around"> & {
    id: string;
    name: string;
  })[];
  // What the items are, in the plural, as Show all names them.
  noun: string;
  onShow: (id: string) => void;
  actions: readonly ShortListAction[];
}) {
  return (
    <Stack gap="xs" align="flex-start">
      {items.length === 0 ? (
        <Text c="dimmed">None</Text>
      ) : (
        <FoldedList items={items} first={shownFirst} noun={noun}>
          {(shown) => (
            <RecordLinkList
              links={shown.map(({ id, name, around }) => ({
                id,
                name,
                around,
                onShow: () => {
                  onShow(id);
                },
              }))}
            />
          )}
        </FoldedList>
      )}
      {actions.length > 0 && (
        <Group gap="xs">
          {actions.map(({ label, onClick, id }) => (
            <Button key={label} id={id} variant="default" onClick={onClick}>
              {label}
            </Button>
          ))}
        </Group>
      )}
    </Stack>
  );
}
