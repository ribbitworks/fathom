// SPDX-License-Identifier: Apache-2.0

// Tests that Enter ending a word composed with an input method acts on nothing, and the reader's
// Enter after it acts once, in each field that takes typed words: a table's cell, the choice
// picker, and a list's new and edited choices. The New form's field is tested with its panel.

import { MantineProvider } from "@mantine/core";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ChoicePicker } from "./choice-picker.tsx";
import { entryName, focusRow, openPanel } from "./test-lists-page.tsx";
import {
  actions,
  bodyOf,
  composingEnters,
  gadget,
  renderGadgets,
  testTheme,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

// The Enter that ends composing, which leaves the field open, then the reader's own Enter.
async function enterAfterComposing(field: HTMLElement, how: object) {
  fireEvent.keyDown(field, { key: "Enter", ...how });
  expect(field.isConnected).toBe(true);
  await userEvent.keyboard("{Enter}");
}

describe.each(composingEnters)("Enter %s a word", (_, how) => {
  it("saves a table's cell only at the reader's Enter", async () => {
    const update = vi.fn();
    renderGadgets({ gadgets: [gadget("g1")], given: actions({ update }) });
    act(() => {
      document.getElementById("cell-g1-name")?.focus();
    });
    await userEvent.keyboard("Widget");
    await enterAfterComposing(
      screen.getByRole("textbox", { name: "Name" }),
      how,
    );
    await waitFor(() => {
      expect(update).toHaveBeenCalledOnce();
    });
  });

  it("finishes the choice picker with nothing to pick only at the reader's Enter", async () => {
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
    await enterAfterComposing(field, how);
    expect(onDone).toHaveBeenCalledExactlyOnceWith([], "enter");
  });

  it("adds a choice to a list only at the reader's Enter", async () => {
    const { fetch } = await openPanel();
    await userEvent.type(entryName(), "Ashgrove");
    await enterAfterComposing(entryName(), how);
    await waitFor(() => {
      expect(bodyOf(fetch, "POST", "/api/lists/l1/choices")).toHaveLength(1);
    });
  });

  it("saves a choice being edited only at the reader's Enter", async () => {
    const { fetch } = await openPanel();
    focusRow("c2");
    await userEvent.keyboard("{Enter}");
    const name = await screen.findByLabelText<HTMLInputElement>("name");
    await userEvent.type(name, " Lab");
    await enterAfterComposing(name, how);
    await waitFor(() => {
      expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2")).toHaveLength(1);
    });
  });
});
