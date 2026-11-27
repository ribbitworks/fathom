// SPDX-License-Identifier: Apache-2.0

// The Roles page: every role with its description and how many active accounts hold it, and the
// dialogs that show, create and change a role.

import {
  accountLengths,
  type DataClasses,
  keptPermissions,
  lockedPermissions,
  type Permission,
  type RoleEffects,
  roleLengths,
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
  Group,
  Loader,
  Modal,
  Paper,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Textarea,
  TextInput,
  VisuallyHidden,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { accountsQuery, nameProblem } from "./accounts.ts";
import { CountedField } from "./counted-field.tsx";
import { Count, countRoom, countShown } from "./counted-input.tsx";
import { DialogActions, useDialogState } from "./dialog-actions.tsx";
import { notifySuccess } from "./notices.tsx";
import { count } from "./numbers.ts";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { Effects, Summary } from "./roles-consequences.tsx";
import { PermissionGrid } from "./roles-permission-grid.tsx";
import {
  createRole,
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
          <Effects
            effects={effects}
            userId={userId}
            dataClasses={dataClasses}
          />
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
            <CountedField
              control={form.control}
              name="name"
              label="Name"
              maximum={accountLengths.name}
              autoFocus
              disabled={busy}
              error={nameProblem(errors.name, "Name needed")}
            />
            <Textarea
              label="Description"
              autosize
              minRows={2}
              disabled={busy}
              error={errors.description?.message}
              {...(countShown(
                description.trim().length,
                roleLengths.description,
              )
                ? {
                    rightSection: (
                      <Count
                        length={description.trim().length}
                        maximum={roleLengths.description}
                      />
                    ),
                    rightSectionWidth: countRoom(
                      description.trim().length,
                      roleLengths.description,
                    ),
                  }
                : {})}
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
  linked,
  onLinkedOpened,
}: {
  user: SignedInUser;
  canEdit: boolean;
  dataClasses: DataClasses;
  // A role a link opens, whose dialog opens once the roles are read; a dialog isn't kept in the
  // address, so the page then takes it out.
  linked?: string | undefined;
  onLinkedOpened?: () => void;
}) {
  const roles = useQuery(rolesQuery);
  const { dialog, opened, open, close } = useDialogState<Dialog>();
  const linkedOpened = useRef<string | undefined>(undefined);
  useEffect(() => {
    const role = roles.data?.find(({ id }) => id === linked);
    if (role === undefined || linkedOpened.current === role.id) return;
    linkedOpened.current = role.id;
    open({ kind: canEdit ? "edit" : "view", role });
    onLinkedOpened?.();
  }, [roles.data, linked, canEdit, open, onLinkedOpened]);
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
          <div className={[classes.tableScroll, classes.scrollBars].join(" ")}>
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
                      <Text fz="sm">{role.description}</Text>
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
