// SPDX-License-Identifier: Apache-2.0

// Tests for a row of a record's details: a click anywhere on it, its label included, opens its
// editor, as its change button does, except a click on a control of its own.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { Row } from "./record-details.tsx";
import { testTheme } from "./test-support.tsx";

const column = {
  key: "code",
  label: "Code",
  kind: "text" as const,
  multiple: false,
  choices: [],
  required: false,
};

function renderRow(onStart: () => void, action?: ReactNode) {
  render(
    <MantineProvider theme={testTheme}>
      <dl>
        <Row
          column={column}
          value="FX-1"
          editing={{
            open: false,
            editor: null,
            onStart,
            problem: undefined,
          }}
          action={action}
        />
      </dl>
    </MantineProvider>,
  );
}

describe("a row of a record's details", () => {
  it("opens its editor from a click on its label", async () => {
    const onStart = vi.fn();
    renderRow(onStart);

    await userEvent.click(screen.getByText("Code"));

    expect(onStart).toHaveBeenCalledOnce();
  });

  it("opens its editor from its change button once", async () => {
    const onStart = vi.fn();
    renderRow(onStart);

    await userEvent.click(screen.getByRole("button", { name: "Change Code" }));

    expect(onStart).toHaveBeenCalledOnce();
  });

  it("leaves a click in what its own control draws elsewhere, such as a menu", async () => {
    const onStart = vi.fn();
    renderRow(onStart, createPortal(<p>Choose a unit</p>, document.body));

    await userEvent.click(screen.getByText("Choose a unit"));

    expect(onStart).not.toHaveBeenCalled();
  });

  it("leaves a click on a control of its own to that control", async () => {
    const onStart = vi.fn();
    const onAction = vi.fn();
    renderRow(
      onStart,
      <button type="button" onClick={onAction}>
        Units
      </button>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Units" }));

    expect(onAction).toHaveBeenCalledOnce();
    expect(onStart).not.toHaveBeenCalled();
  });
});
