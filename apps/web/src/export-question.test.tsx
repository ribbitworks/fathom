// SPDX-License-Identifier: Apache-2.0

// Tests for the question asked before exporting Personal or Confidential data: what it says, that
// Export exports and closes it, that a refusal stays in it, and that Cancel exports nothing.

import { MantineProvider } from "@mantine/core";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { ApiError } from "./api.ts";
import { ExportQuestion } from "./export-question.tsx";
import { failedExport } from "./exports.ts";
import { testTheme } from "./test-support.tsx";

const question = {
  title: "Export Confidential and Personal data?",
  held: [
    { dataClass: "confidential", columns: ["Salary"] },
    { dataClass: "personal", columns: ["Home address", "Start"] },
  ],
} as const;

function renderQuestion(onExport: () => Promise<void>) {
  const onClose = vi.fn();
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MantineProvider theme={testTheme}>
        <ExportQuestion
          question={question}
          opened
          onExport={onExport}
          onClose={onClose}
          onClosed={() => undefined}
        />
      </MantineProvider>
    </QueryClientProvider>,
  );
  return onClose;
}

describe("ExportQuestion", () => {
  it("names the classes and their columns", async () => {
    renderQuestion(() => Promise.resolve());
    const dialog = await screen.findByRole("dialog", { name: question.title });
    expect(dialog.textContent).toContain(
      "This file holds Confidential data (Salary) and Personal data (Home address, Start).",
    );
  });

  it("exports, then closes, when Export is chosen", async () => {
    const onExport = vi.fn(() => Promise.resolve());
    const onClose = renderQuestion(onExport);
    await userEvent.click(
      await screen.findByRole("button", { name: "Export" }),
    );
    expect(onExport).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it("keeps the dialog open with the reason when the export is refused", async () => {
    const onClose = renderQuestion(() =>
      Promise.reject(new ApiError(403, "This export can't be recorded")),
    );
    await userEvent.click(
      await screen.findByRole("button", { name: "Export" }),
    );
    await screen.findByRole("alert");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("says the export wasn't saved when it fails for a reason the server didn't give", async () => {
    renderQuestion(() => Promise.reject(new Error("Offline")));
    await userEvent.click(
      await screen.findByRole("button", { name: "Export" }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(failedExport);
  });

  it("exports nothing when Cancel is chosen", async () => {
    const onExport = vi.fn(() => Promise.resolve());
    const onClose = renderQuestion(onExport);
    await userEvent.click(
      await screen.findByRole("button", { name: "Cancel" }),
    );
    expect(onExport).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledOnce();
  });
});
