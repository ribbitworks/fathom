// SPDX-License-Identifier: Apache-2.0

// The page where users change their own password, giving their current one. Changing it signs out
// their other sessions, such as on another computer, which the page says once it is done.

import { passwordChangeSchema } from "@fathom/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, Button, Paper, PasswordInput, Stack } from "@mantine/core";
import { useMutation } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { ApiError, describeProblem } from "./api.ts";
import { changePassword } from "./accounts.ts";
import { PageHeader } from "./page-header.tsx";

const formSchema = passwordChangeSchema
  .extend({ repeated: z.string() })
  .refine((values) => values.newPassword === values.repeated, {
    path: ["repeated"],
  });

type FormValues = z.infer<typeof formSchema>;

function problemWith(error: Error): string {
  return error instanceof ApiError && error.code === "INVALID_PASSWORD"
    ? "Your current password is not right."
    : describeProblem(
        error,
        "Fathom could not change your password. Try again in a moment.",
      );
}

export function ChangePassword() {
  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: { currentPassword: "", newPassword: "", repeated: "" },
  });
  const { errors } = form.formState;
  // The passwords sent are not kept once the change is done.
  const changing = useMutation({
    gcTime: 0,
    mutationFn: ({ currentPassword, newPassword }: FormValues) =>
      changePassword({ currentPassword, newPassword }),
    onSuccess: () => {
      form.reset();
    },
  });

  return (
    <Stack gap="md">
      <PageHeader title="Change password" />
      <Paper withBorder p="xl" maw={480}>
        <form
          noValidate
          onSubmit={(event) =>
            void form.handleSubmit((values) => {
              changing.mutate(values);
            })(event)
          }
        >
          <Stack>
            {changing.isSuccess && (
              <Alert color="green" role="status">
                Your password has been changed, and you have been signed out
                everywhere else.
              </Alert>
            )}
            {changing.error && (
              <Alert color="red" role="alert">
                {problemWith(changing.error)}
              </Alert>
            )}
            <PasswordInput
              label="Current password"
              autoComplete="current-password"
              error={errors.currentPassword && "Enter your current password."}
              {...form.register("currentPassword")}
            />
            <PasswordInput
              label="New password"
              autoComplete="new-password"
              error={errors.newPassword && "Use 12 to 128 characters."}
              {...form.register("newPassword")}
            />
            <PasswordInput
              label="New password again"
              autoComplete="new-password"
              error={errors.repeated && "The new passwords do not match."}
              {...form.register("repeated")}
            />
            <Button type="submit" loading={changing.isPending}>
              Change password
            </Button>
          </Stack>
        </form>
      </Paper>
    </Stack>
  );
}
