// SPDX-License-Identifier: Apache-2.0

// Tests that Enter ending a word composed with an input method acts on nothing, in each field that
// takes typed words: a table's cell, the choice picker, and a list's new and edited choices.

import { MantineProvider } from "@mantine/core";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChoicePicker } from "./choice-picker.tsx";
import { entryName, focusRow, openPanel } from "./test-lists-page.tsx";
import {
  actions,
  bodyOf,
  gadget,
  renderGadgets,
  testTheme,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const composing = [
  ["while composing", { isComposing: true }],
  ["as Safari sends it to end composing", { keyCode: 229 }],
] as const;

async function composingEnter(field: HTMLElement, how: object) {
  fireEvent.keyDown(field, { key: "Enter", ...how });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}

describe.each(composing)("Enter %s a word", (_, how) => {
  it("leaves a table's cell open, saving nothing", async () => {
    const update = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], given: actions({ update }) });
    act(() => {
      document.getElementById("cell-g1-name")?.focus();
    });
    await userEvent.keyboard("Widget");
    await composingEnter(screen.getByRole("textbox", { name: "Name" }), how);
    expect(screen.getByRole("textbox", { name: "Name" })).toBeDefined();
    expect(update).not.toHaveBeenCalled();
  });

  it("leaves the choice picker open with nothing to pick", async () => {
    const onDone = vi.fn();
    render(
      <MantineProvider theme={testTheme}>
        <ChoicePicker
          id="picker"
          label="Teams"
          options={[{ value: "a", label: "Alpha" }]}
          multiple={false}
          initial={[]}
          typed=""
          onDone={onDone}
          onCancel={() => undefined}
        />
      </MantineProvider>,
    );
    const field = screen.getByLabelText("Teams");
    await userEvent.type(field, "zz");
    await composingEnter(field, how);
    expect(onDone).not.toHaveBeenCalled();
  });

  it("adds no choice to a list", async () => {
    const { fetch } = await openPanel();
    await userEvent.type(entryName(), "Ashgrove");
    await composingEnter(entryName(), how);
    expect(bodyOf(fetch, "POST", "/api/lists/l1/choices")).toHaveLength(0);
    expect(entryName().value).toBe("Ashgrove");
  });

  it("keeps a choice being edited open, saving nothing", async () => {
    const { fetch } = await openPanel();
    focusRow("c2");
    await userEvent.keyboard("{Enter}");
    const name = await screen.findByLabelText<HTMLInputElement>("name");
    await userEvent.type(name, " Lab");
    await composingEnter(name, how);
    expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2")).toHaveLength(0);
    expect(screen.getByLabelText("name")).toBe(name);
  });
});
