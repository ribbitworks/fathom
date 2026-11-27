// SPDX-License-Identifier: Apache-2.0

// Tests for the Export icon in a page's heading: shown while a table on the page offers its export,
// exporting in the format chosen, turned off while the table shows no rows, and gone once the table
// is.

import { MantineProvider } from "@mantine/core";
import { render, screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import type { ExportFormat } from "./exports.ts";
import {
  PageExportMenu,
  PageExportProvider,
  useOfferedExport,
} from "./page-export.tsx";
import { testTheme } from "./test-support.tsx";

interface Offered {
  onExport: (format: ExportFormat) => void;
  empty?: boolean | undefined;
}

function Table({ onExport, empty = false }: Offered) {
  useOfferedExport(onExport, empty);
  return <p>Fictional table</p>;
}

function Page({ onExport, empty }: Offered) {
  const [shown, setShown] = useState(true);
  return (
    <MantineProvider theme={testTheme}>
      <PageExportProvider person="Fictional Person">
        <PageExportMenu />
        <button
          type="button"
          onClick={() => {
            setShown(false);
          }}
        >
          Hide the table
        </button>
        {shown && <Table onExport={onExport} empty={empty} />}
      </PageExportProvider>
    </MantineProvider>
  );
}

describe("the Export icon", () => {
  it("exports the table in the format chosen", async () => {
    const onExport = vi.fn();
    render(<Page onExport={onExport} />);
    await userEvent.click(screen.getByRole("button", { name: "Export" }));
    await userEvent.click(
      await screen.findByRole("menuitem", { name: "TSV file" }),
    );
    expect(onExport).toHaveBeenCalledWith("tsv");
  });

  it("is turned off while the table shows no rows, its tip and description saying why", async () => {
    render(<Page onExport={vi.fn()} empty />);
    const icon = screen.getByRole("button", { name: "Export" });
    expect(icon).toHaveProperty("disabled", true);
    expect(
      document.getElementById(String(icon.getAttribute("aria-describedby")))
        ?.textContent,
    ).toBe("There's nothing to export");
    await userEvent.hover(icon.parentElement as HTMLElement);
    await waitFor(() => {
      expect(screen.getAllByText("There's nothing to export")).toHaveLength(2);
    });
  });

  it("turns on again once the table shows rows", () => {
    const { rerender } = render(<Page onExport={vi.fn()} empty />);
    rerender(<Page onExport={vi.fn()} empty={false} />);
    expect(
      screen.getByRole("button", { name: "Export" }).getAttribute("disabled"),
    ).toBeNull();
  });

  it("goes once the table offering its export does", async () => {
    render(<Page onExport={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Export" })).not.toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Hide the table" }),
    );
    expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
  });
});
