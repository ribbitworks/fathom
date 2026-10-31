// SPDX-License-Identifier: Apache-2.0

// The Lists page: the choices offered for each person's site, position, level, and role on the team,
// each with when it was last changed and by whom. Users who may edit planning configuration can add,
// edit, and remove choices in dialogs, which cannot be closed while a change is being saved and
// show plainly why a change was refused.

import {
  type ListItem,
  listItemDescriptionLength,
  listItemLabelLength,
  listItemRequestSchema,
  type ListItemRequest,
  type ListName,
  type Lists,
} from "@fathom/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Alert,
  Button,
  Group,
  Loader,
  Menu,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { DialogActions } from "./dialog-actions.tsx";
import {
  addListItem,
  changedBy,
  listsQuery,
  listTitle,
  removeListItem,
  updateListItem,
} from "./lists.ts";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";

type Dialog =
  | { kind: "add"; list: ListName }
  | { kind: "edit" | "remove"; list: ListName; item: ListItem };

interface DialogProps {
  onDone: (notice?: string) => void;
  onBusy: (busy: boolean) => void;
}

function dialogTitle(dialog: Dialog): string {
  switch (dialog.kind) {
    case "add":
      return `Add to ${listTitle(dialog.list)}`;
    case "edit":
      return `Edit ${dialog.item.label}`;
    case "remove":
      return `Remove ${dialog.item.label}`;
  }
}

// A change to the lists, which refreshes them once it has been tried.
function useListChange<Input, Output>(
  change: (input: Input) => Promise<Output>,
  onBusy: (busy: boolean) => void,
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    onMutate: () => {
      onBusy(true);
    },
    onSettled: async () => {
      await queryClient.invalidateQueries({ queryKey: listsQuery.queryKey });
      onBusy(false);
    },
  });
}

// Adds a choice or edits one, with its name and description checked as the server checks them.
function ItemForm({
  initial,
  submitLabel,
  save,
  notice,
  onDone,
  onBusy,
}: DialogProps & {
  initial: ListItemRequest;
  submitLabel: string;
  save: (item: ListItemRequest) => Promise<ListItem>;
  notice: (item: ListItem) => string;
}) {
  const form = useForm<
    z.input<typeof listItemRequestSchema>,
    unknown,
    ListItemRequest
  >({
    resolver: zodResolver(listItemRequestSchema),
    defaultValues: initial,
  });
  const saving = useListChange(save, onBusy);
  return (
    <form
      noValidate
      onSubmit={(event) =>
        void form.handleSubmit((item) => {
          saving.mutate(item, {
            onSuccess: (item) => {
              onDone(notice(item));
            },
          });
        })(event)
      }
    >
      <Stack>
        <TextInput
          label="Name"
          data-autofocus
          error={
            form.formState.errors.label &&
            `Enter a name of up to ${String(listItemLabelLength.maximum)} characters.`
          }
          {...form.register("label")}
        />
        <Textarea
          label="Description"
          description="Optional. Say what the choice means, for anyone unsure which to pick."
          rows={3}
          error={
            form.formState.errors.description &&
            `Use up to ${String(listItemDescriptionLength.maximum)} characters.`
          }
          {...form.register("description")}
        />
        <DialogActions
          error={saving.error}
          pending={saving.isPending}
          label={submitLabel}
          onCancel={onDone}
        />
      </Stack>
    </form>
  );
}

function RemoveItem({
  list,
  item,
  onDone,
  onBusy,
}: DialogProps & { list: ListName; item: ListItem }) {
  const removing = useListChange(() => removeListItem(list, item.id), onBusy);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        removing.mutate(undefined, {
          onSuccess: () => {
            onDone(`Removed ${item.label} from ${listTitle(list)}.`);
          },
        });
      }}
    >
      <Stack>
        <Text size="sm">
          People will no longer be able to choose {item.label}. The change
          history keeps a record of it.
        </Text>
        <DialogActions
          error={removing.error}
          pending={removing.isPending}
          label="Remove"
          danger
          onCancel={onDone}
        />
      </Stack>
    </form>
  );
}

function DialogContent({ dialog, ...props }: DialogProps & { dialog: Dialog }) {
  switch (dialog.kind) {
    case "add":
      return (
        <ItemForm
          initial={{ label: "", description: "" }}
          submitLabel="Add"
          save={(item) => addListItem(dialog.list, item)}
          notice={(item) => `Added ${item.label} to ${listTitle(dialog.list)}.`}
          {...props}
        />
      );
    case "edit":
      return (
        <ItemForm
          initial={{
            label: dialog.item.label,
            description: dialog.item.description,
          }}
          submitLabel="Save"
          save={(item) => updateListItem(dialog.list, dialog.item.id, item)}
          notice={(item) => `Saved ${item.label}.`}
          {...props}
        />
      );
    case "remove":
      return <RemoveItem list={dialog.list} item={dialog.item} {...props} />;
  }
}

const changedDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

function ItemRow({
  list,
  item,
  canEdit,
  onOpen,
}: {
  list: ListName;
  item: ListItem;
  canEdit: boolean;
  onOpen: (dialog: Dialog) => void;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Text fz="sm">{item.label}</Text>
        {item.description && (
          <Text fz="xs" c="dimmed">
            {item.description}
          </Text>
        )}
      </Table.Td>
      <Table.Td c="dimmed" fz="xs">
        <time dateTime={item.changed.at} className={classes.figures}>
          {changedDate.format(new Date(item.changed.at))}
        </time>
        {`, ${changedBy(item.changed)}`}
      </Table.Td>
      {canEdit && (
        <Table.Td w={48}>
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Actions for ${item.label}`}
              >
                <span aria-hidden="true">⋯</span>
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                onClick={() => {
                  onOpen({ kind: "edit", list, item });
                }}
              >
                Edit
              </Menu.Item>
              <Menu.Item
                color="red"
                onClick={() => {
                  onOpen({ kind: "remove", list, item });
                }}
              >
                Remove
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        </Table.Td>
      )}
    </Table.Tr>
  );
}

function ListPanel({
  list,
  canEdit,
  onOpen,
}: {
  list: Lists[number];
  canEdit: boolean;
  onOpen: (dialog: Dialog) => void;
}) {
  const title = listTitle(list.name);
  return (
    <Paper withBorder component="section" aria-label={title}>
      <Group justify="space-between" p="md" pb="xs">
        <Title order={2} fz={16}>
          {title}
        </Title>
        {canEdit && (
          <Button
            size="xs"
            variant="default"
            aria-label={`Add to ${title}`}
            onClick={() => {
              onOpen({ kind: "add", list: list.name });
            }}
          >
            Add
          </Button>
        )}
      </Group>
      {list.items.length === 0 ? (
        <Text px="md" pb="md" fz="sm" c="dimmed">
          No choices yet.
        </Text>
      ) : (
        <Table verticalSpacing="xs" horizontalSpacing="md">
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Choice</Table.Th>
              <Table.Th>Last changed</Table.Th>
              {canEdit && (
                <Table.Th>
                  <VisuallyHidden>Actions</VisuallyHidden>
                </Table.Th>
              )}
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {list.items.map((item) => (
              <ItemRow
                key={item.id}
                list={list.name}
                item={item}
                canEdit={canEdit}
                onOpen={onOpen}
              />
            ))}
          </Table.Tbody>
        </Table>
      )}
    </Paper>
  );
}

export function ListsPage({ canEdit }: { canEdit: boolean }) {
  const lists = useQuery(listsQuery);
  // The dialog stays set while it closes, so its content does not vanish mid-animation.
  const [dialog, setDialog] = useState<Dialog>();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string>();

  const open = (next: Dialog) => {
    setNotice(undefined);
    setDialog(next);
    setOpened(true);
  };
  const close = (done?: string) => {
    setNotice(done);
    setOpened(false);
  };

  return (
    <Stack gap="md">
      <PageHeader
        title="Lists"
        description="The choices offered for each person's site, position, level, and role on the team."
      />
      {notice && (
        <Alert color="green" role="status">
          {notice}
        </Alert>
      )}
      {lists.isPending && <Loader role="status" aria-label="Loading" />}
      {lists.isError && (
        <Alert color="red" role="alert">
          Fathom could not load the lists. Try again in a moment.
        </Alert>
      )}
      {lists.isSuccess && (
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="md">
          {lists.data.map((list) => (
            <ListPanel
              key={list.name}
              list={list}
              canEdit={canEdit}
              onOpen={open}
            />
          ))}
        </SimpleGrid>
      )}
      <Modal
        opened={opened}
        onClose={() => {
          close();
        }}
        closeOnEscape={!busy}
        closeOnClickOutside={!busy}
        withCloseButton={!busy}
        title={dialog && dialogTitle(dialog)}
      >
        {dialog && (
          <DialogContent dialog={dialog} onDone={close} onBusy={setBusy} />
        )}
      </Modal>
    </Stack>
  );
}
