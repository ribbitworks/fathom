// SPDX-License-Identifier: Apache-2.0

// The Roles page: every role on the shared table, with its description and how many active accounts
// hold it, its details beside the table, and the dialogs that show, create and change a role.

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
  Menu,
  Modal,
  SimpleGrid,
  Stack,
  Textarea,
  TextInput,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import type { z } from "zod";
import { accountsQuery, nameProblem } from "./accounts.ts";
import { CountedField } from "./counted-field.tsx";
import { Count, countRoom, countShown } from "./counted-input.tsx";
import { DialogActions, useDialogState } from "./dialog-actions.tsx";
import { notifySuccess } from "./notices.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { LiveRecordGrid } from "./live-record-grid.tsx";
import { Effects, Summary } from "./roles-consequences.tsx";
import { recordMenu } from "./row-menus.tsx";
import { RolePanel, rolePanelId } from "./roles-panel.tsx";
import {
  type RoleAction,
  roleActions,
  roleColumnOrder,
  roleColumns,
  roleHolders,
  type RoleRow,
  roleRows,
  rolesTable,
} from "./roles-table.tsx";
import { useSavedViews } from "./saved-views.tsx";
import { useNarrow } from "./side-panel.tsx";
import type { View } from "./table-view.ts";
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

// What an item of a role's menu is called, and the dialog it opens on the role.
function roleItem(action: RoleAction): {
  label: string;
  dialog: (role: RoleSummary) => Dialog;
} {
  switch (action) {
    case "edit":
      return { label: "Edit…", dialog: (role) => ({ kind: "edit", role }) };
    case "copy":
      return { label: "Copy…", dialog: (from) => ({ kind: "create", from }) };
    case "view":
      return { label: "View…", dialog: (role) => ({ kind: "view", role }) };
  }
}

export function RolesPage({
  user,
  canEdit,
  dataClasses,
  view,
  onView,
  applied,
  onApply,
  canShareViews,
  open: openId,
  onOpen,
}: {
  user: SignedInUser;
  canEdit: boolean;
  dataClasses: DataClasses;
  view: View;
  onView: (view: View, replace?: boolean) => void;
  // The saved view the view started from, as the address names it.
  applied: string | undefined;
  onApply: (view: View, id: string, replace?: boolean) => void;
  canShareViews: boolean;
  // The role whose details are shown beside the table, by its identifier.
  open: string | undefined;
  onOpen: (id: string | undefined) => void;
}) {
  const roles = useQuery(rolesQuery);
  const { dialog, opened, open, close } = useDialogState<Dialog>();
  const [busy, setBusy] = useState(false);
  const narrow = useNarrow();
  const navigate = useNavigate();
  const views = useSavedViews({
    table: "roles",
    within: rolesQuery.queryKey,
    view,
    applied,
    onApply,
    canShare: canShareViews,
    blocked: opened,
  });
  const rows = roleRows(roles.data ?? []);
  // The accounts holding a role, read once its details open.
  const accounts = useQuery({
    ...accountsQuery,
    enabled: rows.some(({ id }) => id === openId),
  });
  const roleItems = recordMenu<RoleRow>(
    roleActions(canEdit).map((action) => {
      const { label, dialog: dialogFor } = roleItem(action);
      return [
        label,
        (row) => {
          open(dialogFor(row.role));
        },
      ];
    }),
  );
  const table = rolesTable({
    onOpen: (role) => {
      onOpen(role.id);
    },
    // Set apart from the items every row offers, since these open the role's dialogs.
    menuItems: (row) => (
      <>
        <Menu.Divider />
        {roleItems(row)}
      </>
    ),
  });
  const details = (row: RoleRow, onClose: () => void) => ({
    key: "role",
    id: rolePanelId,
    name: "the role's details",
    node: (
      <RolePanel
        key={row.id}
        row={row}
        columns={roleColumns()}
        holders={
          accounts.isError
            ? "failed"
            : accounts.data === undefined
              ? "loading"
              : roleHolders(row.id, accounts.data)
        }
        narrow={narrow}
        onShowAccount={(id) => {
          void navigate({ to: "/accounts", search: { open: id } });
        }}
        onClose={onClose}
      />
    ),
  });

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
        <LiveRecordGrid
          records={rows}
          table={table}
          order={roleColumnOrder}
          view={view}
          onView={onView}
          saved={views.saved}
          open={openId}
          onOpen={onOpen}
          details={details}
        />
      )}
      {views.dialogs}
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
