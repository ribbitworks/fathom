// SPDX-License-Identifier: Apache-2.0

// Tests for the Export icon in a page's heading: shown while a table on the page offers its export,
// exporting in the format chosen, and gone once the table is.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
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

function Table({ onExport }: { onExport: (format: ExportFormat) => void }) {
  useOfferedExport(onExport);
  return <p>Fictional table</p>;
}

function Page({ onExport }: { onExport: (format: ExportFormat) => void }) {
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
        {shown && <Table onExport={onExport} />}
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

  it("goes once the table offering its export does", async () => {
    render(<Page onExport={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Export" })).not.toBeNull();
    await userEvent.click(
      screen.getByRole("button", { name: "Hide the table" }),
    );
    expect(screen.queryByRole("button", { name: "Export" })).toBeNull();
  });
});
