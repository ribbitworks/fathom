// SPDX-License-Identifier: Apache-2.0

// The sign-in page: an email address and password, checked with the same schema as the server, and
// plain messages when they are refused, when there have been too many attempts, or when the user
// was signed out after a time without use. After signing in, the user goes to the page they were
// trying to reach.

import {
  type SignInRequest,
  sessionIdleMinutes,
  signInRequestSchema,
} from "@fathom/shared";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  Alert,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  TextInput,
  VisuallyHidden,
} from "@mantine/core";
import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { Brand } from "./brand.tsx";
import classes from "./pages.module.css";
import { safeRedirect, signIn } from "./session.ts";

type Problem = "refused" | "too-many-attempts" | "failed";

const messages = new Map<Problem, string>([
  ["refused", "That email address and password do not match an account."],
  ["too-many-attempts", "Too many attempts. Wait a minute, then try again."],
  ["failed", "Fathom could not reach its server. Try again in a moment."],
]);

const idleMessageId = "signed-out-idle";

export function SignIn({
  redirect,
  idle = false,
}: {
  redirect: string | undefined;
  idle?: boolean;
}) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [problem, setProblem] = useState<Problem>();
  const form = useForm<SignInRequest>({
    resolver: zodResolver(signInRequestSchema),
    defaultValues: { email: "", password: "" },
  });
  const { errors, isSubmitting } = form.formState;

  async function submit(values: SignInRequest) {
    setProblem(undefined);
    let result;
    try {
      result = await signIn(values);
    } catch {
      setProblem("failed");
      return;
    }
    if (result !== "signed-in") {
      setProblem(result);
      return;
    }
    // Nothing loaded for an earlier user, whose session may have ended, is shown to this one.
    queryClient.clear();
    router.history.push(safeRedirect(redirect));
  }

  return (
    <Center mih="100vh" p="md" className={classes.canvas}>
      <Stack w="100%" maw={360} gap="xl">
        <Center>
          <Brand size="large" />
        </Center>
        <Paper withBorder p="xl">
          <form
            noValidate
            aria-describedby={idle && !problem ? idleMessageId : undefined}
            onSubmit={(event) => void form.handleSubmit(submit)(event)}
          >
            <Stack>
              <VisuallyHidden component="h1">Sign in</VisuallyHidden>
              {problem ? (
                <Alert color="red" role="alert">
                  {messages.get(problem)}
                </Alert>
              ) : (
                idle && (
                  <Alert id={idleMessageId} role="status">
                    Signed out after {sessionIdleMinutes} minutes without use.
                  </Alert>
                )
              )}
              <TextInput
                label="Email address"
                type="email"
                autoComplete="username"
                error={errors.email && "Enter the email address."}
                {...form.register("email")}
              />
              <PasswordInput
                label="Password"
                autoComplete="current-password"
                error={errors.password && "Enter the password."}
                {...form.register("password")}
              />
              <Button type="submit" loading={isSubmitting}>
                Sign in
              </Button>
            </Stack>
          </form>
        </Paper>
      </Stack>
    </Center>
  );
}
