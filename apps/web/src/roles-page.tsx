// SPDX-License-Identifier: Apache-2.0

// The Roles page, for users who may see roles: every role with its description and how many active
// accounts hold it, and a dialog showing what each grants, read only for those who may not edit
// roles. Those who may edit roles create a role, from nothing or as a copy of another, change one,
// or put a starting role back to Fathom's own version. The dialog sets what a role grants in a grid
// of areas and data classes with their actions, beside the result in plain English: the pages and
// views its holders see and do not see, and what they can and cannot do, marked against what the
// role granted when the dialog opened, to which its boxes can be reset. A box that does nothing
// without others is turned off until one of them is ticked, and unticking them unticks it. The box
// that alone leaves some active account able to manage access cannot be unticked. Before a
// change to a role held by accounts is saved, the dialog lists what each account would gain and
// lose, to be confirmed. A dialog cannot be closed while its change is being saved, and shows
// plainly why a change was refused, such as when someone else changed the role after it was
// opened.

import {
  classNames,
  type DataClasses,
  gridActions,
  type GridRow,
  impliedPermissions,
  eitherOf,
  keptPermissions,
  lockedPermissions,
  type Permission,
  permissionDescriptions,
  permissionGrid,
  permissionLabel,
  type RoleEffects,
  roleRequestSchema,
  roleSchema,
  type RoleSummary,
  sameGrants,
  startingRoles,
  withImplied,
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
import { accountsQuery, nameProblem } from "./accounts.ts";
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
  markedLines,
  needsMet,
  previewRole,
  rolesQuery,
  updateRole,
  withNeedsMet,
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

// One permission's box: ticked when granted, or ticked and greyed when another granted one brings
// it, such as viewing with editing, or when it must stay. It is turned off while it would do
// nothing without others not granted.
function PermissionBox({
  permission,
  granted,
  locked,
  disabled,
  onChange,
  label,
  description,
}: {
  permission: Permission;
  granted: readonly Permission[];
  locked: readonly Permission[];
  disabled: boolean;
  onChange: ((granted: Permission[]) => void) | undefined;
  label?: string;
  description?: string;
}) {
  const comesWith = impliedBy(permission, granted);
  const name = permissionLabel(permission);
  const kept = locked.includes(permission);
  const checked = granted.includes(permission) || comesWith !== undefined;
  // A box already ticked stays free to untick, even on a role saved before its needs were kept to.
  const waiting =
    onChange !== undefined &&
    !checked &&
    !needsMet(permission, withImplied(granted));
  // The permission is always one of the shared list.
  // eslint-disable-next-line security/detect-object-injection
  const { needs = [] } = permissionDescriptions[permission];
  return (
    <Checkbox
      display={label === undefined ? "inline-block" : undefined}
      label={label}
      description={description}
      aria-label={
        label !== undefined
          ? undefined
          : comesWith !== undefined
            ? `${name}, which comes with ${permissionLabel(comesWith)}`
            : kept
              ? `${name}, which some active account must keep`
              : waiting
                ? `${name}, which needs ${eitherOf(needs.map(permissionLabel))}`
                : name
      }
      checked={checked}
      disabled={disabled || comesWith !== undefined || kept || waiting}
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
  );
}

type BoxProps = Omit<Parameters<typeof PermissionBox>[0], "permission">;

// What a role grants, in two parts: a grid of the areas it reaches, with View, Approve and Edit,
// followed by the classes of data it sees and changes within them, with View and Edit; and the
// permissions of their own. General data comes with each area. Read only without a way to change
// it.
function PermissionGrid({
  granted,
  locked = [],
  disabled,
  onChange,
}: {
  granted: readonly Permission[];
  locked?: readonly Permission[];
  disabled: boolean;
  onChange?: (granted: Permission[]) => void;
}) {
  const box: BoxProps = { granted, locked, disabled, onChange };
  const cells = (actions: GridRow["actions"]) =>
    gridActions.map((action) => {
      // The action is always one of the fixed list.
      // eslint-disable-next-line security/detect-object-injection
      const permission = actions[action];
      return permission === undefined ? (
        <Table.Td key={action} />
      ) : (
        <Table.Td key={action} ta="center">
          <PermissionBox permission={permission} {...box} />
        </Table.Td>
      );
    });
  return (
    <Stack gap="sm" role="group" aria-label="What the role grants">
      <Table withTableBorder verticalSpacing={4}>
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
          {permissionGrid
            .filter(({ kind }) => kind === "area")
            .map(({ area, actions }) => (
              <Table.Tr key={area}>
                <Table.Td>{area}</Table.Td>
                {cells(actions)}
              </Table.Tr>
            ))}
          <Table.Tr>
            <Table.Th colSpan={gridActions.length + 1} scope="colgroup">
              Data classification
            </Table.Th>
          </Table.Tr>
          <Table.Tr>
            <Table.Td>{classNames.general}</Table.Td>
            {gridActions.map((action) => (
              <Table.Td key={action} ta="center">
                {action !== "approve" && (
                  <Checkbox
                    display="inline-block"
                    // The action is always one of the fixed list.
                    // eslint-disable-next-line security/detect-object-injection
                    aria-label={`${actionHeadings[action]} ${classNames.general}, which comes with each area`}
                    checked
                    disabled
                    readOnly
                  />
                )}
              </Table.Td>
            ))}
          </Table.Tr>
          {permissionGrid.flatMap((row) =>
            row.kind === "class"
              ? [
                  <Table.Tr key={row.area}>
                    <Table.Td>{classNames[row.dataClass]}</Table.Td>
                    {cells(row.actions)}
                  </Table.Tr>,
                ]
              : [],
          )}
        </Table.Tbody>
      </Table>
      {permissionGrid
        .filter(({ kind }) => kind === "single")
        .flatMap(({ actions }) => Object.values(actions))
        .map((permission) => (
          <PermissionBox
            key={permission}
            permission={permission}
            label={permissionLabel(permission)}
            description={
              // The permission is always one of the shared list.
              // eslint-disable-next-line security/detect-object-injection
              permissionDescriptions[permission].allows
            }
            {...box}
          />
        ))}
    </Stack>
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

// Sentences marked against those the dialog opened with: added ones highlighted, and those taken
// away struck through, which screen readers hear from the summary's live region.
function ChangingSentences({
  title,
  first,
  items,
}: {
  title: string;
  first: readonly string[];
  items: readonly string[];
}) {
  const lines = markedLines(first, items);
  if (lines.length === 0) return null;
  return (
    <Stack gap={4}>
      <Title order={3} fz="sm">
        {title}
      </Title>
      <List size="sm" spacing={2}>
        {lines.map(({ text, change }) => (
          <List.Item key={text}>
            {change !== undefined && (
              <VisuallyHidden>
                {change === "removed" ? "No longer: " : "New: "}
              </VisuallyHidden>
            )}
            {/* The mark goes on the text itself, which a list item does not pass it down to. */}
            <span
              className={
                change === "added"
                  ? roleClasses.added
                  : change === "removed"
                    ? roleClasses.removed
                    : undefined
              }
            >
              <Line text={text} />
            </span>
          </List.Item>
        ))}
      </List>
    </Stack>
  );
}

// The pages and views a role's holders see, with a line saying so when there are none.
function seen(sees: string[]): string[] {
  return sees.length === 0 ? ["Nothing."] : sees;
}

// The result of a role's permissions in plain English, which follows the grid as it changes, marked
// against what the role granted first.
function Summary({
  first,
  granted,
  dataClasses,
}: {
  first: readonly Permission[];
  granted: readonly Permission[];
  dataClasses: DataClasses;
}) {
  const before = consequences(first, dataClasses);
  const now = consequences(granted, dataClasses);
  return (
    <Paper
      withBorder
      p="sm"
      role="region"
      aria-live="polite"
      aria-label="What the role allows"
    >
      <Stack gap="sm">
        <ChangingSentences
          title="Sees"
          first={seen(before.sees)}
          items={seen(now.sees)}
        />
        <ChangingSentences
          title="Doesn't see"
          first={before.doesNotSee}
          items={now.doesNotSee}
        />
        <ChangingSentences title="Can" first={before.can} items={now.can} />
        <ChangingSentences
          title="Cannot"
          first={before.cannot}
          items={now.cannot}
        />
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
function RoleView({
  role,
  dataClasses,
  onDone,
}: {
  role: RoleSummary;
  dataClasses: DataClasses;
  onDone: () => void;
}) {
  return (
    <Stack>
      <SimpleGrid cols={{ base: 1, md: 2 }} spacing="lg">
        <Stack>
          <TextInput label="Name" value={role.name} readOnly />
          <Textarea
            label="Description"
            autosize
            minRows={2}
            value={role.description}
            readOnly
          />
          <PermissionGrid granted={role.permissions} disabled={false} />
        </Stack>
        <Summary
          first={role.permissions}
          granted={role.permissions}
          dataClasses={dataClasses}
        />
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
  dataClasses,
  onDone,
  onBusy,
}: {
  dialog: Exclude<Dialog, { kind: "view" }>;
  userId: string;
  dataClasses: DataClasses;
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
  const first = source?.permissions ?? [];
  const [granted, setGranted] = useState<Permission[]>([...first]);
  const changeGranted = (next: Permission[]) => {
    // Boxes ticked without their needs when the role was saved stay until unticked.
    const held = withImplied(granted);
    setGranted(
      withNeedsMet(
        next,
        granted.filter((permission) => !needsMet(permission, held)),
      ),
    );
  };
  // Each kept permission the role grants that no other role would leave some active account with.
  const accounts = useQuery({
    ...accountsQuery,
    enabled: dialog.kind === "edit",
  });
  const roles = useQuery(rolesQuery);
  // While the accounts load, the kept permissions stay, as they may be the last.
  const locked =
    dialog.kind !== "edit"
      ? []
      : accounts.data === undefined || roles.data === undefined
        ? accounts.isError
          ? []
          : keptPermissions.filter((permission) => granted.includes(permission))
        : lockedPermissions(dialog.role.id, granted, accounts.data, roles.data);
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
            onCancel={() => {
              setEffects(null);
            }}
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
              label="Description"
              autosize
              minRows={2}
              disabled={busy}
              error={
                errors.description && `${String(errors.description.message)}.`
              }
              {...form.register("description")}
            />
            <PermissionGrid
              granted={granted}
              locked={locked}
              disabled={busy}
              onChange={changeGranted}
            />
          </Stack>
          <Summary first={first} granted={granted} dataClasses={dataClasses} />
        </SimpleGrid>
        <DialogActions
          error={saving.error ?? previewing.error}
          pending={busy}
          label={dialog.kind === "edit" ? "Save" : "Create role"}
          onCancel={onDone}
          beforeCancel={
            <>
              {starting !== undefined && (
                <Button
                  variant="default"
                  disabled={busy || asStarted}
                  onClick={() => {
                    const { template } = starting;
                    form.setValue("name", template.name, {
                      shouldDirty: true,
                    });
                    form.setValue("description", template.description, {
                      shouldDirty: true,
                    });
                    setGranted([
                      ...template.permissions,
                      ...locked.filter(
                        (permission) =>
                          !template.permissions.includes(permission),
                      ),
                    ]);
                  }}
                >
                  Restore template
                </Button>
              )}
              <Button
                variant="default"
                disabled={busy || sameGrants(granted, first)}
                onClick={() => {
                  setGranted([...first]);
                }}
              >
                Reset
              </Button>
            </>
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
  dataClasses,
}: {
  user: SignedInUser;
  canEdit: boolean;
  dataClasses: DataClasses;
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
                  <Table.Th>Description</Table.Th>
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
          <RoleView
            role={dialog.role}
            dataClasses={dataClasses}
            onDone={close}
          />
        )}
        {dialog !== undefined && dialog.kind !== "view" && (
          <RoleForm
            key={JSON.stringify(dialog)}
            dialog={dialog}
            userId={user.id}
            dataClasses={dataClasses}
            onDone={close}
            onBusy={setBusy}
          />
        )}
      </Modal>
    </Stack>
  );
}
