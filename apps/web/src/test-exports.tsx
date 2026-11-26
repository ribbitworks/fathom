// SPDX-License-Identifier: Apache-2.0

// Helpers for the tests of a page's export.

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { expect } from "vitest";
import type { savedFiles } from "./test-support.tsx";

// Exports the page's table as a CSV file from the Export icon in its heading, saved at once as a file
// holding only General data is, and reads it back: its name and its lines.
export async function exportedCsv(
  files: ReturnType<typeof savedFiles>,
): Promise<{ name: string; lines: string[] }> {
  await userEvent.click(await screen.findByRole("button", { name: "Export" }));
  await userEvent.click(
    await screen.findByRole("menuitem", { name: "CSV file" }),
  );
  await waitFor(() => {
    expect(files).toHaveLength(1);
  });
  const [file] = files;
  return {
    name: file?.name ?? "",
    lines: (await file?.text())?.split("\r\n") ?? [],
  };
}
