// SPDX-License-Identifier: Apache-2.0

// The Roles page, for users who may see roles: every role with what it is for and how many active
// accounts hold it, and a dialog showing what each grants, read only for those who may not edit
// roles. Those who may edit roles create a role, from nothing or as a copy of another, change one,
// or put a starting role back to Fathom's own version. The dialog sets what a role grants in a grid
// of areas and actions, beside the result in plain English: the pages its holders see, what they
// can and cannot do, and any permission that does nothing without another. A starting role's
// summary of what it grants is emptied once what it grants changes, to be written again or left
// empty, and comes back with the rest of Fathom's version. Before a change to a role held by
// accounts is saved, the dialog lists what each account would gain and lose, to be confirmed. A
// dialog cannot be closed while its change is being saved, and shows plainly why a change was
// refused, such as when someone else changed the role after it was opened.

import {
  gridActions,
  impliedPermissions,
  type Permission,
  permissionGrid,
  permissionLabel,
  type RoleEffects,
  roleRequestSchema,
  roleSchema,
  type RoleSummary,
  sameGrants,
  startingRoles,
} from "@fathom/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Checkbox,
  Group,
  List,
  Loader,
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
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { nameProblem } from "./accounts.ts";
import { DialogActions, useDialogState } from "./dialog-actions.tsx";
import { notifySuccess } from "./notices.tsx";
import { count } from "./numbers.ts";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import roleClasses from "./roles-page.module.css";
import {
  actionHeadings,
  consequences,
  createRole,
  difference,
  previewRole,
  rolesQuery,
  updateRole,
} from "./roles.ts";
import { type SignedInUser, sessionQuery } from "./session.ts";

type Dialog =
  | { kind: "create"; from?: RoleSummary }
  | { kind: "edit"; role: RoleSummary }
  | { kind: "view"; role: RoleSummary };

const detailsSchema = roleRequestSchema.pick({ name: true, description: true });

type Details = z.infer<typeof detailsSchema>;

// A line of the summary or the confirmation.
function Line({ text }: { text: string }) {
  return <TierWords text={text} />;
}

// The permission granted with another, such as viewing with editing, if a granted one brings it.
function impliedBy(
  permission: Permission,
  granted: readonly Permission[],
): Permission | undefined {
  return granted.find(
    // The permission is always one of the shared list.
    // eslint-disable-next-line security/detect-object-injection
    (other) => impliedPermissions[other] === permission,
  );
}

// Text with the sensitivity tiers it names in their own colours, so Personal and Confidential
// stand out.
function TierWords({ text }: { text: string }) {
  return (
    <>
      {text.split(/\b(Personal|Confidential)\b/u).map((part, index) =>
        part === "Personal" || part === "Confidential" ? (
          <span
            // Parts keep their place, since the text is split the same way each time.
            key={index}
            className={
              part === "Personal"
                ? roleClasses.personal
                : roleClasses.confidential
            }
          >
            {part}
          </span>
        ) : (
          part
        ),
      )}
    </>
  );
}

// How long a line just added stays highlighted, and one just taken away fades before it goes.
const changeShownFor = 3000;

interface Line {
  text: string;
  change: "added" | "removed" | undefined;
}

// Lines that follow a list as it changes: those added are marked as added, and those taken away
// stay, struck through where they were, for a moment before they go. Each change ends on its own
// time. The first list is shown as it is.
function useChangingLines(items: readonly string[]): Line[] {
  const [lines, setLines] = useState<Line[]>(() =>
    items.map((text) => ({ text, change: undefined })),
  );
  const previous = useRef(items);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  useEffect(() => {
    const before = previous.current;
    previous.current = items;
    const added = items.filter((item) => !before.includes(item));
    const removed = before.filter((item) => !items.includes(item));
    if (added.length === 0 && removed.length === 0) return;
    setLines((current) => {
      const next: Line[] = items.map((text) => ({
        text,
        change:
          added.includes(text) ||
          current.find((line) => line.text === text)?.change === "added"
            ? "added"
            : undefined,
      }));
      // Lines no longer in the list keep their place after the line they followed.
      let after: string | undefined;
      for (const line of current) {
        if (items.includes(line.text)) {
          after = line.text;
          continue;
        }
        const at =
          after === undefined
            ? 0
            : next.findIndex((other) => other.text === after) + 1;
        next.splice(at, 0, { text: line.text, change: "removed" });
        after = line.text;
      }
      return next;
    });
    timers.current.push(
      setTimeout(() => {
        setLines((current) =>
          current.flatMap((line) =>
            removed.includes(line.text) && line.change === "removed"
              ? []
              : added.includes(line.text) && line.change === "added"
                ? [{ text: line.text, change: undefined }]
                : [line],
          ),
        );
      }, changeShownFor),
    );
  }, [items]);
  // No change outlives the page.
  useEffect(
    () => () => {
      for (const timer of timers.current) clearTimeout(timer);
    },
    [],
  );
  return lines;
}

// Whether two lists grant the same permissions, whatever their order.
// The grid of what a role grants, read only without a way to change it.
function PermissionGrid({
  granted,
  disabled,
  onChange,
}: {
  granted: readonly Permission[];
  disabled: boolean;
  onChange?: (granted: Permission[]) => void;
}) {
  return (
    <Table
      withTableBorder
      verticalSpacing={4}
      aria-label="What the role grants"
    >
      <Table.Thead>
        <Table.Tr>
          <Table.Th>Area</Table.Th>
          {gridActions.map((action) => (
            <Table.Th key={action} ta="center">
              {
                // The action is always one of the fixed list.
                // eslint-disable-next-line security/detect-object-injection
                actionHeadings[action]
              }
            </Table.Th>
          ))}
        </Table.Tr>
      </Table.Thead>
      <Table.Tbody>
        {permissionGrid.map(({ area, actions }) => (
          <Table.Tr key={area}>
            <Table.Td>
              <TierWords text={area} />
            </Table.Td>
            {gridActions.map((action) => {
              // The action is always one of the fixed list.
              // eslint-disable-next-line security/detect-object-injection
              const permission = actions[action];
              if (permission === undefined) return <Table.Td key={action} />;
              const comesWith = impliedBy(permission, granted);
              const label = permissionLabel(permission);
              return (
                <Table.Td key={action} ta="center">
                  <Checkbox
                    display="inline-block"
                    aria-label={
                      comesWith === undefined
                        ? label
                        : `${label}, which comes with ${permissionLabel(comesWith)}`
                    }
                    checked={
                      granted.includes(permission) || comesWith !== undefined
                    }
                    disabled={disabled || comesWith !== undefined}
                    readOnly={onChange === undefined}
                    onChange={
                      onChange &&
                      ((event) => {
                        const on = event.currentTarget.checked;
                        onChange(
                          on
                            ? [...granted, permission]
                            : granted.filter((other) => other !== permission),
                        );
                      })
                    }
                  />
                </Table.Td>
              );
            })}
          </Table.Tr>
        ))}
      </Table.Tbody>
    </Table>
  );
}

function Sentences({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <Stack gap={4}>
      <Title order={3} fz="sm">
        {title}
      </Title>
      <List size="sm" spacing={2}>
        {items.map((item) => (
          <List.Item key={item}>
            <Line text={item} />
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}

// A line being taken away: struck through in red, fading until it goes.
function LeavingLine({ text }: { text: string }) {
  return (
    <List.Item>
      <VisuallyHidden>No longer: </VisuallyHidden>
      {/* The mark goes on the text itself, which a list item does not pass it down to. */}
      <span className={roleClasses.removed}>
        <Line text={text} />
      </span>
    </List.Item>
  );
}

// Sentences that follow the grid as it changes, highlighting those just added and striking through
// those just taken away as they fade, which screen readers hear from the summary's live region.
function ChangingSentences({
  title,
  items,
}: {
  title: string;
  items: readonly string[];
}) {
  const lines = useChangingLines(items);
  if (lines.length === 0) return null;
  return (
    <Stack gap={4}>
      <Title order={3} fz="sm">
        {title}
      </Title>
      <List size="sm" spacing={2}>
        {lines.map(({ text, change }) =>
          change === "removed" ? (
            <LeavingLine key={text} text={text} />
          ) : (
            <List.Item key={text}>
              <span
                className={change === "added" ? roleClasses.added : undefined}
              >
                <Line text={text} />
              </span>
            </List.Item>
          ),
        )}
      </List>
    </Stack>
  );
}

// The result of a role's permissions in plain English, which follows the grid as it changes.
function Summary({ granted }: { granted: readonly Permission[] }) {
  const { pages, can, cannot, ineffective } = consequences(granted);
  return (
    <Paper
      withBorder
      p="sm"
      role="region"
      aria-live="polite"
      aria-label="What the role allows"
    >
      <Stack gap="sm">
        {ineffective.length > 0 && (
          <Alert color="yellow" p="xs">
            {ineffective.join(" ")}
          </Alert>
        )}
        <ChangingSentences
          title="Pages its holders see"
          items={pages.length === 0 ? ["None, apart from Help."] : pages}
        />
        <ChangingSentences title="Can" items={can} />
        <ChangingSentences title="Cannot" items={cannot} />
      </Stack>
    </Paper>
  );
}

// What a change to a role would do to each account holding it, to be confirmed before it is saved.
function Effects({
  effects,
  userId,
}: {
  effects: RoleEffects["effects"];
  userId: string;
}) {
  // The confirmation replaces the grid, and the Save button with it, so focus moves to what it says.
  const heading = useRef<HTMLParagraphElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, []);
  return (
    <Stack gap="md">
      <Text ref={heading} tabIndex={-1}>
        {effects.length === 1
          ? "This change affects 1 account."
          : `This change affects ${String(effects.length)} accounts.`}
      </Text>
      {effects.map(({ account, before, after }) => {
        const { gains, losses } = difference(before, after);
        return (
          <Paper key={account.id} withBorder p="sm">
            <Stack gap="xs">
              <Text fw={600}>
                {account.name} ({account.email})
                {account.id === userId && " (this account)"}
              </Text>
              <Sentences title="Gains" items={gains} />
              <Sentences title="Loses" items={losses} />
            </Stack>
          </Paper>
        );
      })}
    </Stack>
  );
}

// What a role grants, for those who may see roles but not edit them.
function RoleView({ role, onDone }: { role: RoleSummary; onDone: () => void }) {
  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Stack>
          <TextInput label="Name" value={role.name} readOnly />
          <Textarea
            label="What it is for"
            autosize
            minRows={2}
            value={role.description}
            readOnly
          />
          <PermissionGrid granted={role.permissions} disabled={false} />
        </Stack>
        <Summary granted={role.permissions} />
      </SimpleGrid>
      <Group justify="flex-end">
        <Button variant="default" data-autofocus onClick={onDone}>
          Close
        </Button>
      </Group>
    </Stack>
  );
}

function RoleForm({
  dialog,
  userId,
  onDone,
  onBusy,
}: {
  dialog: Exclude<Dialog, { kind: "view" }>;
  userId: string;
  onDone: () => void;
  onBusy: (busy: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const source = dialog.kind === "edit" ? dialog.role : dialog.from;
  const form = useForm<Details>({
    resolver: zodResolver(detailsSchema),
    defaultValues: {
      name:
        dialog.kind === "edit"
          ? dialog.role.name
          : source === undefined
            ? ""
            : `Copy of ${source.name}`,
      description: source?.description ?? "",
    },
  });
  const { errors } = form.formState;
  const [granted, setGranted] = useState<Permission[]>(
    source?.permissions ?? [],
  );
  // What the change would do to accounts, once worked out, shown for confirming.
  const [effects, setEffects] = useState<RoleEffects["effects"] | null>(null);
  const saving = useMutation({
    mutationFn: (details: Details) => {
      const request = { ...details, permissions: granted };
      return dialog.kind === "edit"
        ? updateRole(dialog.role.id, {
            ...request,
            updatedAt: dialog.role.updatedAt,
          })
        : createRole(request);
    },
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: rolesQuery.queryKey });
      // The user's own permissions may have changed with a role they hold.
      await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
      await router.invalidate();
      notifySuccess(
        dialog.kind === "edit"
          ? "The role has been changed."
          : "The role has been created.",
      );
      onDone();
    },
  });
  const previewing = useMutation({
    mutationFn: (id: string) => previewRole(id, granted),
    onMutate: () => {
      onBusy(true);
    },
    onSettled: () => {
      onBusy(false);
    },
  });
  const busy = saving.isPending || previewing.isPending;
  // Fathom's own version of a starting role, which the dialog can put back before it is saved.
  const starting = startingVersion(dialog);
  const [name, description] = useWatch({
    control: form.control,
    name: ["name", "description"],
  });
  const asStarted =
    starting !== undefined &&
    name === starting.template.name &&
    description === starting.template.description &&
    sameGrants(granted, starting.template.permissions);
  // Whether a starting role's summary was emptied because what it grants changed.
  const [summaryGone, setSummaryGone] = useState(false);

  // A starting role's summary fits only what it granted when the summary was written: as saved, or
  // as Fathom's version. Once what it grants changes, a summary nobody has rewritten is emptied,
  // and comes back if what it grants is put back.
  const changeGranted = (next: Permission[]) => {
    if (starting !== undefined) {
      const { saved, template } = starting;
      const summaryFor = (grants: readonly Permission[]) =>
        sameGrants(grants, template.permissions)
          ? template.description
          : sameGrants(grants, saved.permissions)
            ? saved.description
            : "";
      const current = form.getValues("description");
      const fitting = summaryFor(next);
      if (current === summaryFor(granted) && fitting !== current) {
        form.setValue("description", fitting, { shouldDirty: true });
        setSummaryGone(fitting === "");
      }
    }
    setGranted(next);
  };

  // A change to a role that changes what some account may do is confirmed first.
  const submit = form.handleSubmit(async (details) => {
    if (dialog.kind === "edit" && effects === null) {
      const found = await previewing.mutateAsync(dialog.role.id);
      if (found.length > 0) {
        setEffects(found);
        return;
      }
    }
    saving.mutate(details);
  });

  if (effects !== null) {
    return (
      <form
        noValidate
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <Stack>
          <Effects effects={effects} userId={userId} />
          <DialogActions
            error={saving.error}
            pending={saving.isPending}
            label="Save changes"
            onCancel={onDone}
            others={
              <Button
                variant="default"
                disabled={busy}
                onClick={() => {
                  setEffects(null);
                }}
              >
                Back
              </Button>
            }
          />
        </Stack>
      </form>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(event) => {
        void submit(event).catch(() => undefined);
      }}
    >
      <Stack>
        <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
          <Stack>
            <TextInput
              label="Name"
              data-autofocus
              disabled={busy}
              error={nameProblem(errors.name, "Enter a name for the role.")}
              {...form.register("name")}
            />
            <Textarea
              label="What it is for"
              autosize
              minRows={2}
              disabled={busy}
              description={
                summaryGone &&
                description === "" &&
                "What the role grants changed, so its old summary is gone."
              }
              error={
                errors.description && `${String(errors.description.message)}.`
              }
              {...form.register("description")}
            />
            <PermissionGrid
              granted={granted}
              disabled={busy}
              onChange={changeGranted}
            />
          </Stack>
          <Summary granted={granted} />
        </SimpleGrid>
        <DialogActions
          error={saving.error ?? previewing.error}
          pending={busy}
          label={dialog.kind === "edit" ? "Save" : "Create role"}
          onCancel={onDone}
          others={
            starting !== undefined && (
              <Button
                variant="default"
                disabled={busy || asStarted}
                onClick={() => {
                  const { template } = starting;
                  form.setValue("name", template.name, { shouldDirty: true });
                  form.setValue("description", template.description, {
                    shouldDirty: true,
                  });
                  setGranted([...template.permissions]);
                  setSummaryGone(false);
                }}
              >
                Restore template
              </Button>
            )
          }
        />
      </Stack>
    </form>
  );
}

// The starting role a dialog edits, if it edits one, as saved, with Fathom's own version of it.
function startingVersion(dialog: Dialog) {
  if (dialog.kind !== "edit") return undefined;
  const key = roleSchema.safeParse(dialog.role.key);
  return key.success
    ? { saved: dialog.role, template: startingRoles[key.data] }
    : undefined;
}

function dialogTitle(dialog: Dialog): string {
  if (dialog.kind === "view") return dialog.role.name;
  if (dialog.kind === "edit") return `Edit ${dialog.role.name}`;
  return dialog.from === undefined ? "New role" : `Copy ${dialog.from.name}`;
}

export function RolesPage({
  user,
  canEdit,
}: {
  user: SignedInUser;
  canEdit: boolean;
}) {
  const roles = useQuery(rolesQuery);
  const { dialog, opened, open, close } = useDialogState<Dialog>();
  const [busy, setBusy] = useState(false);

  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader
        title="Roles"
        action={
          canEdit && (
            <Button
              onClick={() => {
                open({ kind: "create" });
              }}
            >
              New role
            </Button>
          )
        }
      />
      {roles.isPending && <Loader role="status" aria-label="Loading" />}
      {roles.isError && (
        <Alert color="red" role="alert">
          Fathom could not load the roles. Try again in a moment.
        </Alert>
      )}
      {roles.isSuccess && (
        <Paper withBorder className={classes.tableScrollPanel}>
          <div className={classes.tableScroll}>
            <Table miw={640}>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Role</Table.Th>
                  <Table.Th>What it is for</Table.Th>
                  <Table.Th>Accounts</Table.Th>
                  <Table.Th>
                    <VisuallyHidden>Actions</VisuallyHidden>
                  </Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {roles.data.map((role) => (
                  <Table.Tr key={role.id}>
                    <Table.Td fw={600}>{role.name}</Table.Td>
                    <Table.Td>
                      <Text fz="sm">
                        <TierWords text={role.description} />
                      </Text>
                    </Table.Td>
                    <Table.Td>{count(role.accounts)}</Table.Td>
                    <Table.Td>
                      {canEdit ? (
                        <Group gap="xs" wrap="nowrap" justify="flex-end">
                          <Button
                            variant="default"
                            size="xs"
                            aria-label={`Edit ${role.name}`}
                            onClick={() => {
                              open({ kind: "edit", role });
                            }}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="default"
                            size="xs"
                            aria-label={`Copy ${role.name}`}
                            onClick={() => {
                              open({ kind: "create", from: role });
                            }}
                          >
                            Copy
                          </Button>
                        </Group>
                      ) : (
                        <Group justify="flex-end">
                          <Button
                            variant="default"
                            size="xs"
                            aria-label={`View ${role.name}`}
                            onClick={() => {
                              open({ kind: "view", role });
                            }}
                          >
                            View
                          </Button>
                        </Group>
                      )}
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          </div>
        </Paper>
      )}
      <Modal
        opened={opened}
        size="70rem"
        onClose={close}
        closeOnEscape={!busy}
        closeOnClickOutside={!busy}
        withCloseButton={!busy}
        title={dialog && dialogTitle(dialog)}
      >
        {dialog?.kind === "view" && (
          <RoleView role={dialog.role} onDone={close} />
        )}
        {dialog !== undefined && dialog.kind !== "view" && (
          <RoleForm
            key={JSON.stringify(dialog)}
            dialog={dialog}
            userId={user.id}
            onDone={close}
            onBusy={setBusy}
          />
        )}
      </Modal>
    </Stack>
  );
}
