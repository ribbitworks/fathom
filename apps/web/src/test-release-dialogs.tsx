// SPDX-License-Identifier: Apache-2.0

// Helpers for the tests of the Releases page's dialogs: a fictional stream and the server's answer
// saving it, and ways to show a dialog signed in, read what it sent and find its fields.

import { sessionResponseSchema } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, within } from "@testing-library/react";
import type { ReactElement } from "react";
import { type Mock, vi } from "vitest";
import { sessionQuery } from "./session.ts";
import {
  changesSent,
  fictionalStream,
  fictionalUser,
  type serverAnswers,
  streamId,
  testTheme,
} from "./test-support.tsx";

export const changeSetId = "00000000-0000-4000-8000-000000000001";
export const streamPath = `/api/release-streams/${streamId}`;
export const stream = fictionalStream();
export const savedStream = () => Response.json({ stream, changeSetId });

interface Handlers {
  onSaved: Mock;
  onCancel: Mock;
  onBusy: Mock;
}

const saving = (): Handlers => ({
  onSaved: vi.fn(),
  onCancel: vi.fn(),
  onBusy: vi.fn(),
});

export function show(
  dialog: (handlers: Handlers) => ReactElement,
  { signedIn = true } = {},
): Handlers {
  const handlers = saving();
  const client = new QueryClient();
  if (signedIn) {
    client.setQueryData(
      sessionQuery.queryKey,
      sessionResponseSchema.parse(fictionalUser),
    );
  }
  render(
    <MantineProvider theme={testTheme}>
      <QueryClientProvider client={client}>
        {dialog(handlers)}
      </QueryClientProvider>
    </MantineProvider>,
  );
  return handlers;
}

export const bodiesOf = (fetch: ReturnType<typeof serverAnswers>): unknown[] =>
  changesSent(fetch).map(([, body]) => body);

// The rows of a table of cycles, such as "First cycles", each as its text.
export const cyclesIn = (name: string) =>
  within(screen.getByRole("table", { name }))
    .getAllByRole("row")
    .map(({ textContent }) => textContent);

export const box = (name: string) =>
  screen.getByRole<HTMLInputElement>("textbox", { name });
