// SPDX-License-Identifier: Apache-2.0

// The Accounts page, for users who may manage accounts: every account with its roles and whether it
// can sign in, and dialogs to create accounts and to edit them, where their names, email addresses,
// and roles are changed, and from which their passwords are reset and they are deactivated or
// reactivated. A user's own account offers all but the password reset, as changing one's own
// password needs the current one. A dialog cannot be closed while its change is being saved, shows
// plainly why a change was refused, and keeps no password once it closes. The last active
// Administrator can neither give up the role nor be deactivated, so those controls are turned off
// for them, as the server refuses both.

import {
  type Account,
  type AccountChangeRequest,
  newAccountSchema,
  type NewAccountRequest,
  passwordResetSchema,
  type Role,
  roleSchema,
} from "@fathom/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Modal,
  Paper,
  PasswordInput,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  VisuallyHidden,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  accountsQuery,
  createAccount,
  resetPassword,
  roleDescription,
  roleName,
  setActive,
  updateAccount,
} from "./accounts.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { initials } from "./names.ts";
import { notifySuccess } from "./notices.tsx";
import { Icon } from "./icons.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import { type SignedInUser, sessionQuery } from "./session.ts";
import { count } from "./numbers.ts";

type Dialog =
  | { kind: "create" }
  | { kind: "edit"; account: Account; own: boolean; lastAdministrator: boolean }
  | { kind: "password"; account: Account }
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
    case "active":
      return `${dialog.account.active ? "Deactivate" : "Reactivate"} ${dialog.account.name}`;
  }
}

function RoleChoices({
  value,
  onChange,
  kept,
}: {
  value: Role[];
  onChange: (roles: Role[]) => void;
  // A role that cannot be taken away.
  kept?: Role | undefined;
}) {
  return (
    <Checkbox.Group
      label="Roles"
      value={value}
      onChange={(roles) => {
        onChange(roleSchema.options.filter((role) => roles.includes(role)));
      }}
    >
      <Stack gap="sm" mt="xs">
        {roleSchema.options.map((role) => (
          <Checkbox
            key={role}
            value={role}
            label={roleName(role)}
            description={roleDescription(role)}
            disabled={role === kept}
          />
        ))}
      </Stack>
    </Checkbox.Group>
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
      await queryClient.invalidateQueries({ queryKey: accountsQuery.queryKey });
      onBusy(false);
    },
  });
}

function CreateAccount({ onDone, onBusy }: DialogProps) {
  const form = useForm<NewAccountRequest>({
    resolver: zodResolver(newAccountSchema),
    defaultValues: { name: "", email: "", password: "", roles: ["viewer"] },
  });
  const { errors } = form.formState;
  const creating = useAccountChange(createAccount, onBusy);
  return (
    <form
      noValidate
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          creating.mutate(values, {
            onSuccess: (account) => {
              onDone(`Created the account for ${account.name}.`);
            },
          });
        })(event)
      }
    >
      <Stack>
        <TextInput
          label="Name"
          error={errors.name && "Enter the person's name."}
          {...form.register("name")}
        />
        <TextInput
          label="Email address"
          type="email"
          error={errors.email && "Enter a valid email address."}
          {...form.register("email")}
        />
        <PasswordInput
          label="Temporary password"
          autoComplete="new-password"
          error={errors.password && "Use 12 to 128 characters."}
          {...form.register("password")}
        />
        <Controller
          control={form.control}
          name="roles"
          render={({ field }) => (
            <RoleChoices value={field.value} onChange={field.onChange} />
          )}
        />
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

const accountEditSchema = newAccountSchema.pick({
  name: true,
  email: true,
  roles: true,
});

// After users change their own account, the rest of Fathom shows them as they now are: their name
// and email address, and, once they give up the Administrator role, the first page they may open.
function useOwnAccountRefresh() {
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  return async (saved: Account) => {
    await queryClient.invalidateQueries({ queryKey: sessionQuery.queryKey });
    if (saved.roles.includes("administrator")) await router.invalidate();
    else await navigate({ to: "/" });
  };
}

function EditAccount({
  account,
  own,
  lastAdministrator,
  onDone,
  onBusy,
  onOpen,
}: DialogProps & {
  account: Account;
  own: boolean;
  lastAdministrator: boolean;
}) {
  const form = useForm<Omit<NewAccountRequest, "password">>({
    resolver: zodResolver(accountEditSchema),
    defaultValues: {
      name: account.name,
      email: account.email,
      roles: account.roles,
    },
  });
  const { errors } = form.formState;
  const refreshOwn = useOwnAccountRefresh();
  const saving = useAccountChange(
    (change: AccountChangeRequest) => updateAccount(account.id, change),
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
          error={errors.name && "Enter the person's name."}
          {...form.register("name")}
        />
        <TextInput
          label="Email address"
          type="email"
          error={errors.email && "Enter a valid email address."}
          {...form.register("email")}
        />
        <Controller
          control={form.control}
          name="roles"
          render={({ field }) => (
            <RoleChoices
              value={field.value}
              onChange={field.onChange}
              kept={lastAdministrator ? "administrator" : undefined}
            />
          )}
        />
        <DialogActions
          error={saving.error}
          pending={saving.isPending}
          label="Save"
          onCancel={onDone}
          others={
            <>
              {!own && (
                <Button
                  variant="subtle"
                  color="gray"
                  disabled={saving.isPending}
                  onClick={() => {
                    onOpen({ kind: "password", account });
                  }}
                >
                  Reset password
                </Button>
              )}
              <Button
                variant="subtle"
                color={account.active ? "red" : "gray"}
                disabled={saving.isPending || lastAdministrator}
                onClick={() => {
                  onOpen({ kind: "active", account, own });
                }}
              >
                {account.active ? "Deactivate" : "Reactivate"}
              </Button>
            </>
          }
        />
      </Stack>
    </form>
  );
}

function ResetPassword({
  account,
  onDone,
  onBusy,
}: DialogProps & { account: Account }) {
  const form = useForm<{ password: string }>({
    resolver: zodResolver(passwordResetSchema),
    defaultValues: { password: "" },
  });
  const resetting = useAccountChange(
    (password: string) => resetPassword(account.id, password),
    onBusy,
  );
  return (
    <form
      noValidate
      onSubmit={(event) =>
        void form.handleSubmit(({ password }) => {
          resetting.mutate(password, {
            onSuccess: () => {
              onDone(`Reset the password for ${account.name}.`);
            },
          });
        })(event)
      }
    >
      <Stack>
        <Text size="sm">
          {account.name} will be signed out everywhere, and will sign in with
          the new password.
        </Text>
        <PasswordInput
          label="New temporary password"
          autoComplete="new-password"
          error={form.formState.errors.password && "Use 12 to 128 characters."}
          {...form.register("password")}
        />
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
            ? "You will be signed out everywhere, and will not be able to sign in until another Administrator reactivates your account."
            : account.active
              ? `${account.name} will be signed out everywhere, and will not be able to sign in until the account is reactivated.`
              : `${account.name} will be able to sign in again.`}
        </Text>
        <DialogActions
          error={changing.error}
          pending={changing.isPending}
          label={account.active ? "Deactivate" : "Reactivate"}
          onCancel={onDone}
        />
      </Stack>
    </form>
  );
}

function DialogContent({ dialog, ...props }: DialogProps & { dialog: Dialog }) {
  switch (dialog.kind) {
    case "create":
      return <CreateAccount {...props} />;
    case "edit":
      return (
        <EditAccount
          account={dialog.account}
          own={dialog.own}
          lastAdministrator={dialog.lastAdministrator}
          {...props}
        />
      );
    case "password":
      return <ResetPassword account={dialog.account} {...props} />;
    case "active":
      return (
        <ChangeActive account={dialog.account} own={dialog.own} {...props} />
      );
  }
}

const createdDate = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });

type Filter = "all" | "active" | "deactivated";

function matches(account: Account, search: string, filter: Filter): boolean {
  const term = search.trim().toLowerCase();
  const found =
    term === "" ||
    account.name.toLowerCase().includes(term) ||
    account.email.toLowerCase().includes(term);
  const shown = filter === "all" || (filter === "active") === account.active;
  return found && shown;
}

const activeAdministrator = (account: Account) =>
  account.active && account.roles.includes("administrator");

function isLastAdministrator(account: Account, all: Account[]): boolean {
  return (
    activeAdministrator(account) &&
    !all.some((other) => other.id !== account.id && activeAdministrator(other))
  );
}

function AccountRow({
  account,
  own,
  onEdit,
}: {
  account: Account;
  own: boolean;
  onEdit: () => void;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <Avatar size={32} radius="xl" color="sea">
            {initials(account.name)}
          </Avatar>
          <div>
            <Group gap={6} wrap="nowrap">
              <Text fz="sm" fw={500}>
                {account.name}
              </Text>
              {own && (
                <Badge
                  variant="light"
                  color="sea"
                  radius="sm"
                  tt="none"
                  className={classes.ownBadge}
                >
                  You
                </Badge>
              )}
            </Group>
            <Text fz="xs" c="dimmed">
              {account.email}
            </Text>
          </div>
        </Group>
      </Table.Td>
      <Table.Td>
        <Group gap={6}>
          {account.roles.map((role) => (
            <Badge key={role} variant="default" radius="sm" tt="none" fw={400}>
              {roleName(role)}
            </Badge>
          ))}
        </Group>
      </Table.Td>
      <Table.Td>
        <Badge
          variant="light"
          color={account.active ? "green" : "gray"}
          radius="xl"
          tt="none"
          leftSection={<span className={classes.statusDot} />}
        >
          {account.active ? "Active" : "Deactivated"}
        </Badge>
      </Table.Td>
      <Table.Td c="dimmed" className={classes.figures}>
        <time dateTime={account.createdAt}>
          {createdDate.format(new Date(account.createdAt))}
        </time>
      </Table.Td>
      <Table.Td ta="right">
        <Button
          variant="default"
          size="xs"
          aria-label={`Edit ${account.name}`}
          onClick={onEdit}
        >
          Edit
        </Button>
      </Table.Td>
    </Table.Tr>
  );
}

export function AccountsPage({ user }: { user: SignedInUser }) {
  const accounts = useQuery(accountsQuery);
  // The dialog stays set while it closes, so its content does not vanish mid-animation.
  const [dialog, setDialog] = useState<Dialog>();
  const [opened, setOpened] = useState(false);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const open = (next: Dialog) => {
    setDialog(next);
    setOpened(true);
  };
  const close = (done?: string) => {
    if (done !== undefined) notifySuccess(done);
    setOpened(false);
  };
  const all = accounts.data ?? [];
  const activeCount = all.filter((account) => account.active).length;
  const shown = all.filter((account) => matches(account, search, filter));

  return (
    <Stack gap="md" className={classes.tablePage}>
      <PageHeader
        title="Accounts"
        action={
          <Button
            onClick={() => {
              open({ kind: "create" });
            }}
          >
            New account
          </Button>
        }
      />
      {accounts.isPending && <Loader role="status" aria-label="Loading" />}
      {accounts.isError && (
        <Alert color="red" role="alert">
          Fathom could not load the accounts. Try again in a moment.
        </Alert>
      )}
      {accounts.isSuccess && (
        <>
          <Group gap="sm">
            <TextInput
              aria-label="Search by name or email"
              placeholder="Search"
              leftSection={<Icon name="search" />}
              value={search}
              onChange={(event) => {
                setSearch(event.currentTarget.value);
              }}
              w={{ base: "100%", xs: 280 }}
            />
            <SegmentedControl
              aria-label="Show"
              value={filter}
              onChange={(value) => {
                setFilter(value);
              }}
              data={[
                { value: "all", label: `All ${count(all.length)}` },
                { value: "active", label: `Active ${String(activeCount)}` },
                {
                  value: "deactivated",
                  label: `Deactivated ${count(all.length - activeCount)}`,
                },
              ]}
            />
          </Group>
          <Paper withBorder className={classes.tableScrollPanel}>
            <div className={classes.tableScroll}>
              <Table miw={720}>
                <Table.Thead>
                  <Table.Tr>
                    <Table.Th>Person</Table.Th>
                    <Table.Th>Roles</Table.Th>
                    <Table.Th>Status</Table.Th>
                    <Table.Th>Created</Table.Th>
                    <Table.Th>
                      <VisuallyHidden>Actions</VisuallyHidden>
                    </Table.Th>
                  </Table.Tr>
                </Table.Thead>
                <Table.Tbody>
                  {shown.map((account) => (
                    <AccountRow
                      key={account.id}
                      account={account}
                      own={account.id === user.id}
                      onEdit={() => {
                        open({
                          kind: "edit",
                          account,
                          own: account.id === user.id,
                          lastAdministrator: isLastAdministrator(account, all),
                        });
                      }}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </div>
            {shown.length === 0 && (
              <Text p="md" fz="sm" c="dimmed">
                No accounts match.
              </Text>
            )}
          </Paper>
        </>
      )}
      <Modal
        opened={opened}
        // The dialogs that list every role, with what each allows, have room for them.
        size={
          dialog?.kind === "create" || dialog?.kind === "edit" ? "lg" : "md"
        }
        onClose={() => {
          close();
        }}
        closeOnEscape={!busy}
        closeOnClickOutside={!busy}
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
