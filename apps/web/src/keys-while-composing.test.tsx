// SPDX-License-Identifier: Apache-2.0

// Tests that Enter, Esc and Tab pressed while composing a word with an input method act on nothing,
// and the reader's Enter after them acts once, in each field that takes typed words: a table's
// cell, the choice picker, and a list's new and edited choices. The New form's field is tested
// with its panel. No test drives a real input method; each sends the key marked as composing.

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

// A key pressed while composing, which leaves the field open, then the reader's own Enter.
async function enterAfterComposing(
  field: HTMLElement,
  how: object,
  key: string,
) {
  fireEvent.keyDown(field, { key, ...how });
  expect(field.isConnected).toBe(true);
  await userEvent.keyboard("{Enter}");
}

describe.each(composingEnters)("pressed %s a word", (_, how) => {
  it.each(["Enter", "Escape", "Tab"])(
    "%s leaves a table's cell to the reader's Enter, which saves it",
    async (key) => {
      const update = vi.fn();
      renderGadgets({ gadgets: [gadget("g1")], given: actions({ update }) });
      act(() => {
        document.getElementById("cell-g1-name")?.focus();
      });
      await userEvent.keyboard("Widget");
      await enterAfterComposing(
        screen.getByRole("textbox", { name: "Name" }),
        how,
        key,
      );
      await waitFor(() => {
        expect(update).toHaveBeenCalledOnce();
      });
    },
  );

  it.each(["Enter", "Escape", "Tab"])(
    "%s leaves the choice picker to the reader's Enter, which finishes it",
    async (key) => {
      const onDone = vi.fn();
      const onCancel = vi.fn();
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
            onCancel={onCancel}
          />
        </MantineProvider>,
      );
      const field = screen.getByLabelText("Teams");
      await userEvent.type(field, "zz");
      await enterAfterComposing(field, how, key);
      expect(onDone).toHaveBeenCalledExactlyOnceWith([], "enter");
      expect(onCancel).not.toHaveBeenCalled();
    },
  );

  it.each(["Enter", "Escape"])(
    "%s leaves a list's new choice to the reader's Enter, which adds it",
    async (key) => {
      const { fetch } = await openPanel();
      await userEvent.type(entryName(), "Ashgrove");
      await enterAfterComposing(entryName(), how, key);
      await waitFor(() => {
        expect(bodyOf(fetch, "POST", "/api/lists/l1/choices")).toEqual([
          { choices: [expect.objectContaining({ label: "Ashgrove" })] },
        ]);
      });
    },
  );

  it.each(["Enter", "Escape", "Tab"])(
    "%s leaves a choice being edited to the reader's Enter, which saves it",
    async (key) => {
      const { fetch } = await openPanel();
      focusRow("c2");
      await userEvent.keyboard("{Enter}");
      const description =
        await screen.findByLabelText<HTMLInputElement>("description");
      await userEvent.type(description, "By the harbour");
      await enterAfterComposing(description, how, key);
      await waitFor(() => {
        expect(bodyOf(fetch, "PUT", "/api/lists/l1/choices/c2")).toHaveLength(
          1,
        );
      });
    },
  );
});
