// SPDX-License-Identifier: Apache-2.0

// Tests of keys pressed while composing a word with an input method, in each field that takes typed
// words and in a side panel holding one. No test drives a real input method; each sends the key
// marked as composing. The New form's field is tested with its panel.

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
import type { Field } from "@fathom/shared";
import { ChoicePicker } from "./choice-picker.tsx";
import { SidePanelFrame } from "./side-panel.tsx";
import { entryName, focusRow, openPanel } from "./test-lists-page.tsx";
import {
  actions,
  bodyOf,
  type ComposingMark,
  composingKeys,
  gadget,
  gadgetTable,
  renderGadgets,
  testTheme,
} from "./test-support.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

// A key pressed while composing, which leaves the field open, then the reader's own Enter.
async function enterAfterComposing(
  field: HTMLElement,
  how: ComposingMark,
  key: string,
) {
  fireEvent.keyDown(field, { key, ...how });
  expect(field.isConnected).toBe(true);
  await userEvent.keyboard("{Enter}");
}

describe.each(composingKeys)("pressed %s a word", (_, how) => {
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
  it("leaves the table's search to the reader's Esc, which clears it", async () => {
    renderGadgets({ gadgets: [gadget("g1")] });
    const search = screen.getByRole<HTMLInputElement>("textbox", {
      name: "Search gadgets",
    });
    await userEvent.type(search, "Gad");
    fireEvent.keyDown(search, { key: "Escape", ...how });
    expect(search.value).toBe("Gad");
    await userEvent.keyboard("{Escape}");
    expect(search.value).toBe("");
  });

  it.each([
    ["Escape", "Address"],
    ["Tab", "Text to show"],
  ])(
    "%s leaves a web link being edited to the reader's Esc, which cancels it",
    async (key, label) => {
      const site: Field = {
        id: "f2",
        keyNumber: 1,
        name: "Site",
        type: "link",
        listId: null,
        visibility: "general",
        multiple: false,
        required: false,
        onPlannedHires: true,
      };
      renderGadgets({
        gadgets: [gadget("g1")],
        fields: [site],
        table: gadgetTable(),
      });
      act(() => {
        document.getElementById("cell-g1-f2")?.focus();
      });
      await userEvent.keyboard("{Enter}");
      await userEvent.type(
        await screen.findByRole("textbox", { name: "Address" }),
        "example.test",
      );
      const field = screen.getByRole("textbox", { name: label });
      await userEvent.type(field, "x");
      fireEvent.keyDown(field, { key, ...how });
      expect(screen.getByRole("form", { name: "Site" })).toBeDefined();
      await userEvent.keyboard("{Escape}");
      expect(screen.queryByRole("form", { name: "Site" })).toBeNull();
    },
  );

  it("leaves a side panel holding a field with no keys of its own to the reader's Esc, which closes it", async () => {
    const onClose = vi.fn();
    render(
      <MantineProvider theme={testTheme}>
        <SidePanelFrame
          id="frame"
          titleId="frame-title"
          title="Sites"
          narrow={false}
          close={{ label: "Close sites", onClose }}
        >
          <input aria-label="Day" />
        </SidePanelFrame>
      </MantineProvider>,
    );
    const field = screen.getByRole("textbox", { name: "Day" });
    field.focus();
    fireEvent.keyDown(field, { key: "Escape", ...how });
    expect(onClose).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});
