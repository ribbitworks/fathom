// SPDX-License-Identifier: Apache-2.0

// The Accounts page, for users who may manage accounts: every account with its roles and whether it
// can sign in, and dialogs to create accounts, change their roles, reset their passwords, and
// deactivate or reactivate them. A user's own account offers none of these, as the server refuses
// them. A dialog cannot be closed while its change is being saved, shows plainly why a change was
// refused, and keeps no password once it closes.

import {
  type Account,
  newAccountSchema,
  type NewAccountRequest,
  passwordResetSchema,
  type Role,
  roleSchema,
} from "@fathom/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  ActionIcon,
  Alert,
  Avatar,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Menu,
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
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  accountsQuery,
  createAccount,
  resetPassword,
  roleDescription,
  roleName,
  setActive,
  setRoles,
} from "./accounts.ts";
import { DialogActions } from "./dialog-actions.tsx";
import { initials } from "./names.ts";
import { notifySuccess } from "./notices.tsx";
import { PageHeader } from "./page-header.tsx";
import classes from "./pages.module.css";
import type { SignedInUser } from "./session.ts";

type Dialog =
  | { kind: "create" }
  | { kind: "roles" | "password" | "active"; account: Account };

// What a dialog reports: when it is done, with a notice for the page, and when it is busy saving.
interface DialogProps {
  onDone: (notice?: string) => void;
  onBusy: (busy: boolean) => void;
}

function dialogTitle(dialog: Dialog): string {
  switch (dialog.kind) {
    case "create":
      return "New account";
    case "roles":
      return `Roles for ${dialog.account.name}`;
    case "password":
      return `Reset the password for ${dialog.account.name}`;
    case "active":
      return `${dialog.account.active ? "Deactivate" : "Reactivate"} ${dialog.account.name}`;
  }
}

function RoleChoices({
  value,
  onChange,
}: {
  value: Role[];
  onChange: (roles: Role[]) => void;
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
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: change,
    gcTime: 0,
    onMutate: () => {
      onBusy(true);
    },
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
          description="At least 12 characters. Give it to the person, who can then change it."
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

function ChangeRoles({
  account,
  onDone,
  onBusy,
}: DialogProps & { account: Account }) {
  const [roles, setChosen] = useState(account.roles);
  const saving = useAccountChange(
    (chosen: Role[]) => setRoles(account.id, chosen),
    onBusy,
  );
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        saving.mutate(roles, {
          onSuccess: () => {
            onDone(`Changed the roles of ${account.name}.`);
          },
        });
      }}
    >
      <Stack>
        <Text fz="sm" c="dimmed">
          Changes apply the next time {account.name} uses Fathom, and are
          recorded in the access history.
        </Text>
        <RoleChoices value={roles} onChange={setChosen} />
        <DialogActions
          error={saving.error}
          pending={saving.isPending}
          label="Save roles"
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
  onDone,
  onBusy,
}: DialogProps & { account: Account }) {
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
          {account.active
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
    case "roles":
      return <ChangeRoles account={dialog.account} {...props} />;
    case "password":
      return <ResetPassword account={dialog.account} {...props} />;
    case "active":
      return <ChangeActive account={dialog.account} {...props} />;
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

function AccountRow({
  account,
  own,
  onOpen,
}: {
  account: Account;
  own: boolean;
  onOpen: (dialog: Dialog) => void;
}) {
  return (
    <Table.Tr>
      <Table.Td>
        <Group gap="sm" wrap="nowrap">
          <Avatar size={32} radius="xl" color="sea">
            {initials(account.name)}
          </Avatar>
          <div>
            <Text fz="sm" fw={500}>
              {account.name}
            </Text>
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
      <Table.Td>
        {own ? (
          <Text fz="xs" c="dimmed">
            Your account
          </Text>
        ) : (
          <Menu position="bottom-end">
            <Menu.Target>
              <ActionIcon
                variant="subtle"
                color="gray"
                aria-label={`Actions for ${account.name}`}
              >
                <span aria-hidden="true">⋯</span>
              </ActionIcon>
            </Menu.Target>
            <Menu.Dropdown>
              <Menu.Item
                onClick={() => {
                  onOpen({ kind: "roles", account });
                }}
              >
                Change roles
              </Menu.Item>
              <Menu.Item
                onClick={() => {
                  onOpen({ kind: "password", account });
                }}
              >
                Reset password
              </Menu.Item>
              <Menu.Item
                {...(account.active ? { color: "red" } : {})}
                onClick={() => {
                  onOpen({ kind: "active", account });
                }}
              >
                {account.active ? "Deactivate" : "Reactivate"}
              </Menu.Item>
            </Menu.Dropdown>
          </Menu>
        )}
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
    <Stack gap="md">
      <PageHeader
        title="Accounts"
        description="Who can sign in to Fathom, and what their roles let them do."
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
              placeholder="Search by name or email"
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
                { value: "all", label: `All ${String(all.length)}` },
                { value: "active", label: `Active ${String(activeCount)}` },
                {
                  value: "deactivated",
                  label: `Deactivated ${String(all.length - activeCount)}`,
                },
              ]}
            />
          </Group>
          <Paper withBorder>
            <Table.ScrollContainer minWidth={720}>
              <Table verticalSpacing="sm" horizontalSpacing="md">
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
                      onOpen={open}
                    />
                  ))}
                </Table.Tbody>
              </Table>
            </Table.ScrollContainer>
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
