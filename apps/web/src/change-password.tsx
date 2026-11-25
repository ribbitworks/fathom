// SPDX-License-Identifier: Apache-2.0

// Users changing their own password, in a dialog from their account's menu or on the page shown
// while they sign in with a password Fathom generated.

import {
  chosenPasswordProblem,
  type GuessableCheck,
  passwordChangeFields,
  type PasswordOwner,
  passwordRequirements,
  type PasswordRules,
  refusingSamePassword,
  samePasswordMessage,
} from "@fathom/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Center,
  Group,
  Paper,
  PasswordInput,
  Stack,
  Text,
  Title,
  VisuallyHidden,
} from "@mantine/core";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate, useRouter } from "@tanstack/react-router";
import { type ReactNode, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { z } from "zod";
import { ApiError, describeProblem } from "./api.ts";
import { changePassword } from "./accounts.ts";
import { Brand } from "./brand.tsx";
import { BusyModal, DialogActions } from "./dialog-actions.tsx";
import { useGuessableCheck } from "./guessable.ts";
import { Icon } from "./icons.tsx";
import { notifySuccess } from "./notices.tsx";
import classes from "./pages.module.css";
import { sessionQuery, signOut } from "./session.ts";

// The check for guessable passwords is left to the server until it has loaded.
const formSchemaFor = (
  rules: PasswordRules,
  owner: PasswordOwner,
  isGuessable: GuessableCheck | undefined,
) =>
  refusingSamePassword(
    passwordChangeFields.extend({
      newPassword: z.string().superRefine((password, context) => {
        const problem = chosenPasswordProblem(
          rules,
          password,
          owner,
          isGuessable,
        );
        if (problem !== undefined) {
          context.addIssue({ code: "custom", message: problem });
        }
      }),
      repeated: z.string(),
    }),
  ).refine((values) => values.newPassword === values.repeated, {
    path: ["repeated"],
  });

type FormValues = z.infer<ReturnType<typeof formSchemaFor>>;

// A wrong current password is named under its field, which takes the focus; other problems are put as
// every dialog puts them.
const isWrongPassword = (error: unknown): boolean =>
  error instanceof ApiError && error.code === "INVALID_PASSWORD";

// Each requirement for the new password, with a mark and words for whether it is met, so neither
// relies on colour. One not met stays neutral while the password is typed, and turns red only once
// the field is left or the form is sent.
function PasswordChecklist({
  rules,
  owner,
  password,
  isGuessable,
  showUnmet,
}: {
  rules: PasswordRules;
  owner: PasswordOwner;
  password: string;
  isGuessable: GuessableCheck | undefined;
  showUnmet: boolean;
}) {
  const items = [
    ...passwordRequirements(rules).map(({ label, isMet }) => ({
      label,
      met: isMet(password),
    })),
    {
      label: "Not a common or easily guessed password",
      met:
        isGuessable !== undefined &&
        password.length > 0 &&
        !isGuessable(password, owner),
    },
  ];
  return (
    <span role="list" className={classes.passwordChecklist}>
      {items.map(({ label, met }) => {
        const state = met ? "met" : showUnmet ? "unmet" : "pending";
        return (
          <span
            key={label}
            role="listitem"
            className={classes.passwordRequirement}
            data-state={state}
          >
            <Icon
              name={met ? "check" : showUnmet ? "close" : "pending"}
              size={14}
            />
            {label}
            <VisuallyHidden>{met ? " (met)" : " (not met)"}</VisuallyHidden>
          </span>
        );
      })}
    </span>
  );
}

function PasswordForm({
  rules,
  owner,
  onDone,
  onBusy,
  actions,
}: {
  rules: PasswordRules;
  owner: PasswordOwner;
  onDone: () => Promise<void> | void;
  onBusy?: (busy: boolean) => void;
  // The buttons at the form's foot, with why the change was refused, unless it was a wrong current
  // password, which is named under its field.
  actions: (state: { pending: boolean; error: Error | null }) => ReactNode;
}) {
  const isGuessable = useGuessableCheck();
  const formSchema = useMemo(
    () => formSchemaFor(rules, owner, isGuessable),
    [rules, owner, isGuessable],
  );
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: "", newPassword: "", repeated: "" },
  });
  const { errors, touchedFields, isSubmitted } = form.formState;
  const newPassword = useWatch({ control: form.control, name: "newPassword" });
  // The passwords sent are not kept once the change is done.
  const changing = useMutation({
    gcTime: 0,
    mutationFn: ({ currentPassword, newPassword }: FormValues) =>
      changePassword({ currentPassword, newPassword }),
    onMutate: () => {
      onBusy?.(true);
    },
    onSettled: () => {
      onBusy?.(false);
    },
    onError: (error) => {
      if (isWrongPassword(error)) {
        form.setError(
          "currentPassword",
          { type: "server", message: "The current password is not right." },
          { shouldFocus: true },
        );
      }
    },
    onSuccess: async () => {
      notifySuccess(
        "The password has been changed, and every other session has been signed out.",
      );
      await onDone();
    },
  });
  return (
    <form
      noValidate
      onSubmit={(event) =>
        void form.handleSubmit((values) => {
          changing.mutate(values);
        })(event)
      }
    >
      <Stack>
        <PasswordInput
          label="Current password"
          autoComplete="current-password"
          data-autofocus
          error={
            errors.currentPassword &&
            (errors.currentPassword.type === "server"
              ? errors.currentPassword.message
              : "Enter the current password.")
          }
          {...form.register("currentPassword")}
        />
        <PasswordInput
          label="New password"
          autoComplete="new-password"
          description={
            <PasswordChecklist
              rules={rules}
              owner={owner}
              password={newPassword}
              isGuessable={isGuessable}
              showUnmet={touchedFields.newPassword === true || isSubmitted}
            />
          }
          inputWrapperOrder={["label", "input", "description", "error"]}
          error={
            errors.newPassword?.message === samePasswordMessage
              ? `${samePasswordMessage}.`
              : errors.newPassword?.message
          }
          {...form.register("newPassword")}
        />
        <PasswordInput
          label="New password again"
          autoComplete="new-password"
          error={errors.repeated && "The new passwords do not match."}
          {...form.register("repeated")}
        />
        {actions({
          pending: changing.isPending,
          error: isWrongPassword(changing.error) ? null : changing.error,
        })}
      </Stack>
    </form>
  );
}

export function ChangePasswordDialog({
  rules,
  owner,
  opened,
  onClose,
}: {
  rules: PasswordRules;
  owner: PasswordOwner;
  opened: boolean;
  onClose: () => void;
}) {
  // Its form starts afresh each time it opens, since the dialog's content is removed once it has
  // closed.
  return (
    <BusyModal opened={opened} onClose={onClose} title="Change password">
      {(onBusy) => (
        <PasswordForm
          rules={rules}
          owner={owner}
          onDone={onClose}
          onBusy={onBusy}
          actions={({ pending, error }) => (
            <DialogActions
              error={error}
              pending={pending}
              label="Change password"
              onCancel={onClose}
            />
          )}
        />
      )}
    </BusyModal>
  );
}

// The page users see in place of every other while they sign in with a password Fathom generated,
// with only Fathom's name and mark above it, like the sign-in page. Once the password is changed,
// Fathom opens as it does after signing in, on the Overview or the first page their role allows.
export function FirstPasswordChange({
  rules,
  owner,
}: {
  rules: PasswordRules;
  owner: PasswordOwner;
}) {
  const queryClient = useQueryClient();
  const router = useRouter();
  const navigate = useNavigate();
  const [signOutFailed, setSignOutFailed] = useState(false);

  async function handleSignOut() {
    try {
      await signOut();
    } catch {
      setSignOutFailed(true);
      return;
    }
    queryClient.clear();
    queryClient.setQueryData(sessionQuery.queryKey, null);
    await navigate({ to: "/sign-in" });
  }

  return (
    <Center mih="100vh" p="md" className={classes.signIn}>
      <Stack w="100%" maw={400} gap="xl">
        <Center>
          <Brand size="large" />
        </Center>
        <Paper withBorder p="xl">
          <Stack>
            <Title order={1} size="h3">
              Change password
            </Title>
            <Text size="sm">
              Fathom generated this password. A new password is required to
              continue.
            </Text>
            <PasswordForm
              rules={rules}
              owner={owner}
              onDone={async () => {
                await queryClient.invalidateQueries({
                  queryKey: sessionQuery.queryKey,
                });
                await router.invalidate();
              }}
              actions={({ pending, error }) => (
                <>
                  {error && (
                    <Alert color="red" role="alert">
                      {describeProblem(
                        error,
                        "Fathom could not change the password. Try again in a moment.",
                      )}
                    </Alert>
                  )}
                  {signOutFailed && (
                    <Alert color="red" role="alert">
                      Fathom could not sign out. Try again in a moment.
                    </Alert>
                  )}
                  <Group justify="space-between">
                    <Button
                      variant="default"
                      disabled={pending}
                      onClick={() => void handleSignOut()}
                    >
                      Sign out
                    </Button>
                    <Button type="submit" loading={pending}>
                      Change password
                    </Button>
                  </Group>
                </>
              )}
            />
          </Stack>
        </Paper>
      </Stack>
    </Center>
  );
}
