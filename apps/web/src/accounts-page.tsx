// SPDX-License-Identifier: Apache-2.0

// The Accounts page: every account on the shared table, and the dialogs that create and edit
// accounts, reset passwords, and deactivate and reactivate accounts.

import {
  type Account,
  newAccountSchema,
  type RoleSummary,
} from "@fathom/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Anchor,
  Button,
  Checkbox,
  CopyButton,
  Group,
  Loader,
  Modal,
  PasswordInput,
  Radio,
  Stack,
  Text,
  TextInput,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useRouter } from "@tanstack/react-router";
import { type ReactNode, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import {
  accountsQuery,
  refusedChanges,
  createAccount,
  defaultAmong,
  nameProblem,
  resetPassword,
  setActive,
  updateAccount,
} from "./accounts.ts";
import { DialogActions, useDialogState } from "./dialog-actions.tsx";
import { notifySuccess } from "./notices.tsx";
import { rolesQuery } from "./roles.ts";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { type SignedInUser, sessionQuery } from "./session.ts";
import {
  accountColumnOrder,
  accountColumns,
  type AccountRow,
  accountRows,
  accountsTable,
} from "./accounts-table.tsx";
import { AccountPanel, accountPanelId } from "./accounts-panel.tsx";
import {
  focusRecordCell,
  noRecordActions,
  RecordGrid,
} from "./record-grid.tsx";
import { useNarrow } from "./side-panel.tsx";
import { useSavedViews } from "./saved-views.tsx";
import { TableTips } from "./table-tips.tsx";
import type { View } from "./table-view.ts";

type Dialog =
  | { kind: "create" }
  | {
      kind: "edit";
      account: Account;
      own: boolean;
      // Every account, as the list showed them, for knowing which changes the server refuses.
      accounts: readonly Account[];
    }
  | { kind: "password"; account: Account }
  | { kind: "generated"; account: Account; password: string; notice: string }
  | { kind: "active"; account: Account; own: boolean };

// What a dialog reports: when it is done, with a notice for the page, when it is busy saving, and
// when it opens another dialog in its place.
interface DialogProps {
  onDone: (notice?: string) => void;
  onBusy: (busy: boolean) => void;
  onOpen: (dialog: Dialog) => void;
}

function dialogTitle(dialog: Dialog): string {
  switch (dialog.kind) {
    case "create":
      return "New account";
    case "edit":
      return `Edit ${dialog.account.name}`;
    case "password":
      return `Reset the password for ${dialog.account.name}`;
    case "generated":
      return `Password for ${dialog.account.name}`;
    case "active":
      return `${dialog.account.active ? "Deactivate" : "Reactivate"} ${dialog.account.name}`;
  }
}

const roleProblem = "Choose a role.";

// What the account dialogs edit: the person's name and email address, the roles they hold, and
// which of those is their default.
const accountFormSchema = newAccountSchema.extend({
  roleIds: z.array(z.uuid()).min(1),
});

type AccountForm = z.infer<typeof accountFormSchema>;

// The account's roles, from every role, each with what it is for, and, with several picked, which
// of them is the default.
function RolesChoice({
  form,
  roles,
  refused,
}: {
  form: ReturnType<typeof useForm<AccountForm>>;
  roles: readonly RoleSummary[];
  // Roles the server would refuse to take away, turned off.
  refused?: ReadonlySet<string>;
}) {
  const picked = useWatch({ control: form.control, name: "roleIds" });
  const { errors } = form.formState;
  return (
    <Stack gap="md">
      <Controller
        control={form.control}
        name="roleIds"
        render={({ field }) => (
          <Checkbox.Group
            label="Roles"
            value={field.value}
            onChange={(roleIds) => {
              field.onChange(roleIds);
              form.setValue(
                "roleId",
                defaultAmong(roleIds, form.getValues("roleId")),
              );
            }}
            error={errors.roleIds && roleProblem}
          >
            <Stack gap="sm" mt="xs">
              {roles.map((role) => (
                <Checkbox
                  key={role.id}
                  value={role.id}
                  label={role.name}
                  description={role.description}
                  disabled={refused?.has(role.id)}
                />
              ))}
              <Text size="sm" c="dimmed">
                Custom roles are created on the{" "}
                <Anchor component={Link} to="/roles" inherit>
                  Roles
                </Anchor>{" "}
                page.
              </Text>
            </Stack>
          </Checkbox.Group>
        )}
      />
      {picked.length > 1 && (
        <Controller
          control={form.control}
          name="roleId"
          render={({ field }) => (
            <Radio.Group
              label="Default role"
              value={field.value}
              onChange={field.onChange}
            >
              <Group gap="md" mt="xs">
                {roles
                  .filter(({ id }) => picked.includes(id))
                  .map((role) => (
                    <Radio key={role.id} value={role.id} label={role.name} />
                  ))}
              </Group>
            </Radio.Group>
          )}
        />
      )}
    </Stack>
  );
}

// A change to accounts, which refreshes the list once it has been tried. Passwords sent are not
// kept.
function useAccountChange<Input, Output>(
  change: (input: Input) => Promise<Output>,
  onBusy: (busy: boolean) => void,
  // Finishes before the list refreshes, as when a user's own access changes.
  onSaved: (output: Output) => Promise<void> = async () => {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    gcTime: 0,
    onMutate: () => {
      onBusy(true);
    },
    onSuccess: onSaved,
    onSettled: async () => {
      // The Roles page counts the accounts holding each role.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: accountsQuery.queryKey }),
        queryClient.invalidateQueries({ queryKey: rolesQuery.queryKey }),
      ]);
      onBusy(false);
    },
  });
}

function CreateAccount({
  roles,
  onDone,
  onBusy,
  onOpen,
}: DialogProps & { roles: readonly RoleSummary[] }) {
  // A new account sees the plan unless other roles are chosen.
  const teamMember = roles.find(({ key }) => key === "team-member")?.id;
  const form = useForm<AccountForm>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: "",
      email: "",
      roleId: teamMember ?? "",
      roleIds: teamMember === undefined ? [] : [teamMember],
    },
  });
  const { errors } = form.formState;
  const creating = useAccountChange(createAccount, onBusy);
  return (
    <form
      noValidate
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          creating.mutate(values, {
            onSuccess: ({ account, password }) => {
              onOpen({
                kind: "generated",
                account,
                password,
                notice: `Created the account for ${account.name}.`,
              });
            },
          });
        })(event)
      }
    >
      <Stack>
        <TextInput
          label="Name"
          error={nameProblem(errors.name, "Enter the person's name.")}
          {...form.register("name")}
        />
        <TextInput
          label="Email address"
          type="email"
          error={errors.email && "Enter a valid email address."}
          {...form.register("email")}
        />
        <RolesChoice form={form} roles={roles} />
        <DialogActions
          error={creating.error}
          pending={creating.isPending}
          label="Create account"
          onCancel={onDone}
        />
      </Stack>
    </form>
  );
}

// After users change their own account, the rest of Fathom shows them as they now are: their name,
// email address, and roles, and, once the role they act as no longer lets them manage accounts, the
// first page they may open.
function useOwnAccountRefresh() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  return async () => {
    const session = await queryClient.query({
      ...sessionQuery,
      staleTime: 0,
    });
    if (session?.permissions.includes("administration:edit"))
      await router.invalidate();
    else await navigate({ to: "/" });
  };
}

function EditAccount({
  account,
  own,
  accounts,
  roles,
  onDone,
  onBusy,
}: DialogProps & {
  account: Account;
  own: boolean;
  accounts: readonly Account[];
  roles: readonly RoleSummary[];
}) {
  const form = useForm<AccountForm>({
    resolver: zodResolver(accountFormSchema),
    defaultValues: {
      name: account.name,
      email: account.email,
      roleId: account.role?.id ?? "",
      roleIds: account.roles.map(({ id }) => id),
    },
  });
  const { errors } = form.formState;
  const picked = useWatch({ control: form.control, name: "roleIds" });
  const refused = refusedChanges(account, picked, accounts, roles);
  const refreshOwn = useOwnAccountRefresh();
  const saving = useAccountChange(
    (change: AccountForm) => updateAccount(account.id, change),
    onBusy,
    own ? refreshOwn : undefined,
  );
  return (
    <form
      noValidate
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          saving.mutate(values, {
            onSuccess: (saved) => {
              onDone(`Saved the account for ${saved.name}.`);
            },
          });
        })(event)
      }
    >
      <Stack>
        <TextInput
          label="Name"
          error={nameProblem(errors.name, "Enter the person's name.")}
          {...form.register("name")}
        />
        <TextInput
          label="Email address"
          type="email"
          error={errors.email && "Enter a valid email address."}
          {...form.register("email")}
        />
        <RolesChoice form={form} roles={roles} refused={refused.roleIds} />
        <DialogActions
          error={saving.error}
          pending={saving.isPending}
          label="Save"
          onCancel={onDone}
        />
      </Stack>
    </form>
  );
}

function ResetPassword({
  account,
  onDone,
  onBusy,
  onOpen,
}: DialogProps & { account: Account }) {
  const resetting = useAccountChange(() => resetPassword(account.id), onBusy);
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        resetting.mutate(undefined, {
          onSuccess: (password) => {
            onOpen({
              kind: "generated",
              account,
              password,
              notice: `Reset the password for ${account.name}.`,
            });
          },
        });
      }}
    >
      <Stack>
        <Text size="sm">
          {account.name} will be signed out of every session. Fathom will
          generate a new password, which {account.name} must change at the next
          sign-in.
        </Text>
        <DialogActions
          error={resetting.error}
          pending={resetting.isPending}
          label="Reset password"
          onCancel={onDone}
        />
      </Stack>
    </form>
  );
}

// The password Fathom generated, shown this once, hidden until asked for, with a button to copy it
// either way. It is plain grey text rather than a field, since it cannot be changed.
function GeneratedPassword({
  account,
  password,
  notice,
  onDone,
}: DialogProps & { account: Account; password: string; notice: string }) {
  return (
    <Stack>
      <Text size="sm">
        This password is shown only once. {account.name} must change it at the
        next sign-in.
      </Text>
      <Group gap="xs" wrap="nowrap">
        <PasswordInput
          aria-label="Password"
          value={password}
          readOnly
          variant="filled"
          flex={1}
          classNames={{ innerInput: classes.generatedPassword }}
          visibilityToggleFocusable
          visibilityToggleButtonProps={{ "aria-label": "Show password" }}
          onFocus={(event) => {
            event.currentTarget.select();
          }}
        />
        <CopyButton value={password}>
          {({ copied, copy }) => (
            <Button variant="default" onClick={copy}>
              {copied ? "Copied" : "Copy"}
            </Button>
          )}
        </CopyButton>
      </Group>
      <Group justify="flex-end">
        <Button
          onClick={() => {
            onDone(notice);
          }}
        >
          Done
        </Button>
      </Group>
    </Stack>
  );
}

function ChangeActive({
  account,
  own,
  onDone,
  onBusy,
}: DialogProps & { account: Account; own: boolean }) {
  const changing = useAccountChange(
    (active: boolean) => setActive(account.id, active),
    onBusy,
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        changing.mutate(!account.active, {
          onSuccess: () => {
            onDone(
              `${account.active ? "Deactivated" : "Reactivated"} the account for ${account.name}.`,
            );
          },
        });
      }}
    >
      <Stack>
        <Text size="sm">
          {own
            ? "This account will be signed out everywhere, and won't be able to sign in until an Administrator reactivates it."
            : account.active
              ? `${account.name} will be signed out everywhere, and will not be able to sign in until the account is reactivated.`
              : `${account.name} will be able to sign in again.`}
        </Text>
        <DialogActions
          error={changing.error}
          pending={changing.isPending}
          label={account.active ? "Deactivate" : "Reactivate"}
          removes={account.active}
          onCancel={onDone}
        />
      </Stack>
    </form>
  );
}

// The dialogs that choose a role wait for the roles, which they list.
function RolesFor({
  children,
}: {
  children: (roles: readonly RoleSummary[]) => ReactNode;
}) {
  const roles = useQuery(rolesQuery);
  if (roles.isPending) return <Loader role="status" aria-label="Loading" />;
  if (roles.isError) {
    return (
      <Alert color="red" role="alert">
        Fathom could not load the roles. Try again in a moment.
      </Alert>
    );
  }
  return children(roles.data);
}

function DialogContent({ dialog, ...props }: DialogProps & { dialog: Dialog }) {
  switch (dialog.kind) {
    case "create":
      return (
        <RolesFor>
          {(roles) => <CreateAccount roles={roles} {...props} />}
        </RolesFor>
      );
    case "edit":
      return (
        <RolesFor>
          {(roles) => (
            <EditAccount
              account={dialog.account}
              own={dialog.own}
              accounts={dialog.accounts}
              roles={roles}
              {...props}
            />
          )}
        </RolesFor>
      );
    case "password":
      return <ResetPassword account={dialog.account} {...props} />;
    case "generated":
      return (
        <GeneratedPassword
          account={dialog.account}
          password={dialog.password}
          notice={dialog.notice}
          {...props}
        />
      );
    case "active":
      return (
        <ChangeActive account={dialog.account} own={dialog.own} {...props} />
      );
  }
}

export function AccountsPage({
  user,
  canManage,
  view,
  onView,
  applied,
  onApply,
  canShareViews,
  open: openId,
  onOpen,
}: {
  user: SignedInUser;
  canManage: boolean;
  view: View;
  onView: (view: View, replace?: boolean) => void;
  // The saved view the view started from, as the address names it.
  applied: string | undefined;
  onApply: (view: View, id: string, replace?: boolean) => void;
  canShareViews: boolean;
  // The account whose details are shown beside the table, by its identifier.
  open: string | undefined;
  onOpen: (id: string | undefined) => void;
}) {
  const accounts = useQuery(accountsQuery);
  // Read now, so the dialogs that choose a role have them on opening, and the panel knows which
  // accounts may not be deactivated.
  const roles = useQuery({ ...rolesQuery, enabled: canManage });
  const narrow = useNarrow();
  const {
    dialog,
    opened,
    open,
    close: closeDialog,
    forget,
  } = useDialogState<Dialog>();
  const [busy, setBusy] = useState(false);
  const views = useSavedViews({
    table: "accounts",
    within: accountsQuery.queryKey,
    view,
    applied,
    onApply,
    canShare: canShareViews,
    blocked: opened,
  });

  const close = (done?: string) => {
    if (done !== undefined) notifySuccess(done);
    closeDialog();
  };
  const all = accounts.data ?? [];
  const table = accountsTable({
    accounts: all,
    ownId: user.id,
    onOpen: (account) => {
      onOpen(account.id);
    },
  });
  const rows = accountRows(all);
  const shownRow = rows.find(({ id }) => id === openId);
  const closePanel = (id: string) => {
    focusRecordCell(id, "name");
    onOpen(undefined);
  };
  const actionsFor = (account: Account) => {
    const own = account.id === user.id;
    return {
      edit: () => {
        open({ kind: "edit", account, own, accounts: all });
      },
      resetPassword: () => {
        open({ kind: "password", account });
      },
      changeActive:
        roles.data !== undefined &&
        refusedChanges(
          account,
          account.roles.map(({ id }) => id),
          all,
          roles.data,
        ).deactivating
          ? undefined
          : () => {
              open({ kind: "active", account, own });
            },
    };
  };
  const panels =
    shownRow === undefined
      ? []
      : [
          {
            key: "account",
            id: accountPanelId,
            name: "the account's details",
            node: (
              <AccountPanel
                key={shownRow.id}
                row={shownRow}
                columns={accountColumns(all, user.id)}
                own={shownRow.id === user.id}
                actions={canManage ? actionsFor(shownRow.account) : undefined}
                narrow={narrow}
                onClose={() => {
                  closePanel(shownRow.id);
                }}
              />
            ),
          },
        ];

  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader
        title="Accounts"
        action={
          canManage && (
            <Button
              onClick={() => {
                open({ kind: "create" });
              }}
            >
              New account
            </Button>
          )
        }
      />
      {accounts.isPending && <Loader role="status" aria-label="Loading" />}
      {accounts.isError && (
        <Alert color="red" role="alert">
          Fathom could not load the accounts. Try again in a moment.
        </Alert>
      )}
      {accounts.isSuccess && (
        <TableTips>
          <RecordGrid
            records={rows}
            table={table}
            fields={[]}
            order={accountColumnOrder}
            lists={[]}
            canEdit={false}
            canAdd={false}
            rowActions={false}
            canEditColumns={false}
            actions={noRecordActions<AccountRow, never, undefined>()}
            view={view}
            onView={onView}
            saved={views.saved}
            panels={panels}
            withDrafts={false}
          />
        </TableTips>
      )}
      {views.dialogs}
      <Modal
        opened={opened}
        // The dialogs that list every role, with what each is for, have room for them.
        size={
          dialog?.kind === "create" || dialog?.kind === "edit" ? "lg" : "md"
        }
        onClose={() => {
          close();
        }}
        // A generated password is not lost to a stray click, and is forgotten once its dialog has
        // closed.
        onExitTransitionEnd={() => {
          if (dialog?.kind === "generated") forget();
        }}
        closeOnEscape={!busy}
        closeOnClickOutside={!busy && dialog?.kind !== "generated"}
        withCloseButton={!busy}
        title={dialog && dialogTitle(dialog)}
      >
        {dialog && (
          <DialogContent
            dialog={dialog}
            onDone={close}
            onBusy={setBusy}
            onOpen={open}
          />
        )}
      </Modal>
    </Stack>
  );
}
