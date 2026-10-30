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
  Alert,
  Badge,
  Button,
  Checkbox,
  Group,
  Loader,
  Menu,
  Modal,
  PasswordInput,
  Stack,
  Table,
  Text,
  TextInput,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Controller, useForm } from "react-hook-form";
import {
  accountsQuery,
  createAccount,
  resetPassword,
  roleName,
  setActive,
  setRoles,
} from "./accounts.ts";
import { describeProblem } from "./api.ts";
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
      <Stack gap="xs" mt="xs">
        {roleSchema.options.map((role) => (
          <Checkbox key={role} value={role} label={roleName(role)} />
        ))}
      </Stack>
    </Checkbox.Group>
  );
}

// A dialog's buttons, and why the change it asked for was refused.
function DialogActions({
  error,
  pending,
  label,
  onCancel,
}: {
  error: Error | null;
  pending: boolean;
  label: string;
  onCancel: () => void;
}) {
  return (
    <>
      {error && (
        <Alert color="red" role="alert">
          {describeProblem(
            error,
            "Fathom could not make this change. Try again in a moment.",
          )}
        </Alert>
      )}
      <Group justify="flex-end">
        <Button
          variant="default"
          disabled={pending}
          onClick={() => {
            onCancel();
          }}
        >
          Cancel
        </Button>
        <Button type="submit" loading={pending}>
          {label}
        </Button>
      </Group>
    </>
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

export function AccountsPage({ user }: { user: SignedInUser }) {
  const accounts = useQuery(accountsQuery);
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
    <Stack>
      <Group justify="space-between">
        <Title order={2}>Accounts</Title>
        <Button
          onClick={() => {
            open({ kind: "create" });
          }}
        >
          New account
        </Button>
      </Group>
      {notice && (
        <Alert color="green" role="status">
          {notice}
        </Alert>
      )}
      {accounts.isPending && <Loader role="status" aria-label="Loading" />}
      {accounts.isError && (
        <Alert color="red" role="alert">
          Fathom could not load the accounts. Try again in a moment.
        </Alert>
      )}
      {accounts.isSuccess && (
        <Table striped>
          <Table.Thead>
            <Table.Tr>
              <Table.Th>Name</Table.Th>
              <Table.Th>Email address</Table.Th>
              <Table.Th>Roles</Table.Th>
              <Table.Th>Status</Table.Th>
              <Table.Th>
                <VisuallyHidden>Actions</VisuallyHidden>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {accounts.data.map((account) => (
              <Table.Tr key={account.id}>
                <Table.Td>{account.name}</Table.Td>
                <Table.Td>{account.email}</Table.Td>
                <Table.Td>
                  <Group gap="xs">
                    {account.roles.map((role) => (
                      <Badge key={role} variant="light">
                        {roleName(role)}
                      </Badge>
                    ))}
                  </Group>
                </Table.Td>
                <Table.Td>{account.active ? "Active" : "Deactivated"}</Table.Td>
                <Table.Td>
                  {account.id === user.id ? (
                    <Text size="sm" c="dimmed">
                      Your account
                    </Text>
                  ) : (
                    <Menu>
                      <Menu.Target>
                        <Button variant="subtle" size="xs">
                          Change {account.name}
                        </Button>
                      </Menu.Target>
                      <Menu.Dropdown>
                        <Menu.Item
                          onClick={() => {
                            open({ kind: "roles", account });
                          }}
                        >
                          Change roles
                        </Menu.Item>
                        <Menu.Item
                          onClick={() => {
                            open({ kind: "password", account });
                          }}
                        >
                          Reset password
                        </Menu.Item>
                        <Menu.Item
                          {...(account.active ? { color: "red" } : {})}
                          onClick={() => {
                            open({ kind: "active", account });
                          }}
                        >
                          {account.active ? "Deactivate" : "Reactivate"}
                        </Menu.Item>
                      </Menu.Dropdown>
                    </Menu>
                  )}
                </Table.Td>
              </Table.Tr>
            ))}
          </Table.Tbody>
        </Table>
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
