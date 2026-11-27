// SPDX-License-Identifier: Apache-2.0

// Tests for the panel that adds a record of the plan: a row for each kind of column, what is checked
// before adding, and what it sends.

import { addressProblem, type FieldType } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { NewPlanRecordPanel } from "./new-plan-record-panel.tsx";
import { type FormValues, newRecordId } from "./new-record-panel.tsx";
import { useNoteEditing } from "./note-editing.tsx";
import type { PlanChange } from "./plan-table.tsx";
import { cellColumn } from "./grid-columns.tsx";
import type { CellRecord, RecordTable } from "./record-table.ts";
import { composingKeys, testTheme } from "./test-support.tsx";

const choice = (id: string, label: string, retired = false) => ({
  id,
  label,
  description: "",
  retired,
});

// An added column of the type given, its values in the record's maps.
const column = (
  key: string,
  kind: FieldType,
  more: { required?: boolean; multiple?: boolean } = {},
) =>
  cellColumn<CellRecord, PlanChange>(key, kind, {
    label: key,
    required: more.required ?? false,
    multiple: more.multiple ?? false,
    choices: [choice("a", "Alpha"), choice("b", "Gone", true)],
    field: {
      id: key,
      keyNumber: 1,
      name: key,
      type: kind,
      listId: null,
      visibility: "general",
      multiple: more.multiple ?? false,
      required: more.required ?? false,
      onPlannedHires: false,
    },
  });

const table = (
  columns: ReturnType<typeof column>[],
  more: Partial<RecordTable<CellRecord, PlanChange, PlanChange>> = {},
) =>
  ({
    columnsFor: () => columns,
    recordProblem: () => undefined,
    request: (changes: PlanChange[]) =>
      Object.assign({}, ...changes) as PlanChange,
    ...more,
  }) as unknown as RecordTable<CellRecord, PlanChange, PlanChange>;

function Harness({
  given,
  saving = false,
  onAdd,
  onCancel = () => undefined,
}: {
  given: RecordTable<CellRecord, PlanChange, PlanChange>;
  saving?: boolean;
  onAdd: (request: PlanChange) => void;
  onCancel?: () => void;
}) {
  const [values, setValues] = useState<FormValues>({});
  const notes = useNoteEditing("panel-title");
  return (
    <>
      <NewPlanRecordPanel
        title="New thing"
        table={given}
        records={[]}
        values={values}
        saving={saving}
        narrow={false}
        panelId="panel"
        notes={notes}
        onValue={(key, value) => {
          setValues((current) => ({ ...current, [key]: value }));
        }}
        onAdd={onAdd}
        onCancel={onCancel}
      />
      {notes.note(newRecordId)?.node}
    </>
  );
}

const renderPanel = (props: Parameters<typeof Harness>[0]) =>
  render(
    <MantineProvider theme={testTheme}>
      <Harness {...props} />
    </MantineProvider>,
  );

const add = () => userEvent.click(screen.getByRole("button", { name: "Add" }));

const change = (key: string) =>
  userEvent.click(screen.getByRole("button", { name: `Change ${key}` }));

// A note opens in its own panel, to read and to write.
const open = (key: string) =>
  userEvent.click(screen.getByRole("button", { name: `Open ${key}` }));

describe("the rows for each kind of column", () => {
  it("sends a picked choice, offering only those not retired", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("owner", "choice")]), onAdd });
    await change("owner");
    const offered = await screen.findByRole("option", { name: "Alpha" });
    expect(screen.queryByRole("option", { name: "Gone" })).toBeNull();
    await userEvent.click(offered);
    await add();
    expect(onAdd).toHaveBeenLastCalledWith(
      { values: { owner: ["a"] } },
      expect.any(Function),
    );
  });

  it("sends several picked choices", async () => {
    const onAdd = vi.fn();
    renderPanel({
      given: table([column("tags", "choice", { multiple: true })]),
      onAdd,
    });
    await change("tags");
    await userEvent.click(await screen.findByRole("option", { name: "Alpha" }));
    await add();
    expect(onAdd).toHaveBeenCalledWith(
      { values: { tags: ["a"] } },
      expect.any(Function),
    );
  });

  it("sends a web link by its address", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("site", "link")]), onAdd });
    await change("site");
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Address" }),
      "https://example.test{Enter}",
    );
    await add();
    expect(onAdd).toHaveBeenLastCalledWith(
      { links: { site: { address: "https://example.test/", text: "" } } },
      expect.any(Function),
    );
  });

  it("empties a text field from its clear button", async () => {
    renderPanel({ given: table([column("name", "text")]), onAdd: vi.fn() });
    const name = screen.getByRole<HTMLInputElement>("textbox", {
      name: "name",
    });
    await userEvent.type(name, "Words");
    await userEvent.click(screen.getByRole("button", { name: "Clear name" }));
    expect(name.value).toBe("");
  });

  it("sends a tick, and takes it away", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("done", "flag")]), onAdd });
    await userEvent.click(screen.getByRole("checkbox", { name: /^done/ }));
    await add();
    expect(onAdd).toHaveBeenLastCalledWith(
      { flags: { done: true } },
      expect.any(Function),
    );
    await userEvent.click(screen.getByRole("checkbox", { name: /^done/ }));
    await add();
    expect(onAdd).toHaveBeenLastCalledWith(
      { flags: { done: null } },
      expect.any(Function),
    );
  });

  it("lays a date out as it is typed, and says an unfinished one is not a date", async () => {
    const onAdd = vi.fn();
    renderPanel({
      given: table([column("when", "date", { required: true })]),
      onAdd,
    });
    const box = screen.getByRole<HTMLInputElement>("textbox", { name: "when" });
    await userEvent.type(box, "20300901");
    expect(box.value).toBe("2030-09-01");
    await userEvent.clear(box);
    await userEvent.type(box, "20");
    await userEvent.tab();
    await add();
    expect(screen.getByText(/^Type a date for when/)).toBeTruthy();
    expect(screen.queryByText("when needed")).toBeNull();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("offers a note that is not required, written in the note's own panel", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("words", "note")]), onAdd });
    expect(screen.queryByRole("textbox")).toBeNull();
    await open("words");
    expect(await screen.findByRole("textbox", { name: "Note" })).toBeTruthy();
    await userEvent.click(
      within(
        screen.getByRole("region", { name: "words for New thing" }),
      ).getByRole("button", { name: "Cancel" }),
    );
    await add();
    expect(onAdd).toHaveBeenCalled();
  });
});

describe("adding", () => {
  it("names a problem with the whole record under its column", async () => {
    const onAdd = vi.fn();
    renderPanel({
      given: table([column("name", "text")], {
        recordProblem: (_values, others) => {
          expect(others()).toEqual([]);
          return { message: "Not this one", column: "name" };
        },
      }),
      onAdd,
    });
    await add();
    expect(screen.getByText("Not this one")).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("adds nothing while a value is refused, and adds once it is put right", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("when", "date")]), onAdd });
    const box = screen.getByRole<HTMLInputElement>("textbox", { name: "when" });
    await userEvent.type(box, "20");
    await userEvent.tab();
    await add();
    expect(onAdd).not.toHaveBeenCalled();
    await userEvent.clear(box);
    await userEvent.type(box, "20300901");
    await userEvent.tab();
    await add();
    expect(onAdd).toHaveBeenCalledOnce();
  });

  it("adds nothing with Enter on a value refused, though a good one was saved before", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("when", "date")]), onAdd });
    const box = screen.getByRole<HTMLInputElement>("textbox", { name: "when" });
    await userEvent.type(box, "20300901");
    await userEvent.tab();
    await userEvent.clear(box);
    await userEvent.type(box, "20{Enter}");
    expect(await screen.findByText(/Type a date for when/)).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("picks with Enter in a picker, adding nothing", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("owner", "choice")]), onAdd });
    await change("owner");
    await screen.findByRole("option", { name: "Alpha" });
    await userEvent.keyboard("{ArrowDown}{Enter}");
    expect(await screen.findByText("Alpha")).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
    await add();
    expect(onAdd).toHaveBeenLastCalledWith(
      { values: { owner: ["a"] } },
      expect.any(Function),
    );
  });

  it("adds nothing while a web link it cannot keep is still being entered", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("site", "link")]), onAdd });
    await change("site");
    await userEvent.type(
      await screen.findByRole("textbox", { name: "Address" }),
      "not an address",
    );
    await add();
    expect(screen.getByText(addressProblem)).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("adds the record with Enter in a field, as Add does", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("name", "text")]), onAdd });
    await userEvent.type(
      screen.getByRole("textbox", { name: "name" }),
      "Words{Enter}",
    );
    await waitFor(() => {
      expect(onAdd).toHaveBeenCalledOnce();
    });
  });

  it.each(composingKeys)(
    "adds only at the reader's Enter after Enter %s a word",
    async (_, composing) => {
      const onAdd = vi.fn();
      renderPanel({ given: table([column("name", "text")]), onAdd });
      const field = screen.getByRole("textbox", { name: "name" });
      await userEvent.type(field, "Words");
      fireEvent.keyDown(field, { key: "Enter", ...composing });
      await userEvent.keyboard("{Enter}");
      await waitFor(() => {
        expect(onAdd).toHaveBeenCalledOnce();
      });
    },
  );

  it.each(composingKeys)(
    "stays open at Esc pressed %s a word, closing at the reader's Esc",
    async (_, composing) => {
      const onCancel = vi.fn();
      renderPanel({
        given: table([column("name", "text")]),
        onAdd: vi.fn(),
        onCancel,
      });
      const field = screen.getByRole("textbox", { name: "name" });
      fireEvent.keyDown(field, { key: "Escape", ...composing });
      expect(onCancel).not.toHaveBeenCalled();
      await userEvent.keyboard("{Escape}");
      expect(onCancel).toHaveBeenCalledOnce();
    },
  );

  it("does not close while saving", async () => {
    const onCancel = vi.fn();
    renderPanel({
      given: table([column("name", "text")]),
      saving: true,
      onAdd: vi.fn(),
      onCancel,
    });
    await userEvent.click(
      screen.getByRole("button", { name: "Close New thing" }),
    );
    expect(onCancel).not.toHaveBeenCalled();
  });
});

describe("opening the form", () => {
  it("puts the cursor in its first field typed into, after a choice shown before it", async () => {
    renderPanel({
      given: table([column("owner", "choice"), column("title", "text")]),
      onAdd: vi.fn(),
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "title" }),
      );
    });
  });

  it("passes over a flag before its first field typed into", async () => {
    renderPanel({
      given: table([column("tick", "flag"), column("title", "text")]),
      onAdd: vi.fn(),
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "title" }),
      );
    });
  });

  it("puts focus on the checkbox of a flag when it has nothing to type into", async () => {
    renderPanel({ given: table([column("tick", "flag")]), onAdd: vi.fn() });
    await waitFor(() => {
      expect(document.activeElement).toBe(screen.getByRole("checkbox"));
    });
  });

  it("opens a form with no fields to type into, leaving focus where it was", async () => {
    renderPanel({ given: table([]), onAdd: vi.fn() });
    expect(await screen.findByRole("button", { name: "Add" })).toBeDefined();
  });

  it("closes on Esc from the field just opened, with nothing typed for Esc to undo", async () => {
    const onCancel = vi.fn();
    renderPanel({
      given: table([column("title", "text")]),
      onAdd: vi.fn(),
      onCancel,
    });
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole("textbox", { name: "title" }),
      );
    });
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });

  it("keeps what was typed on a first Esc, and closes on the next", async () => {
    const onCancel = vi.fn();
    renderPanel({
      given: table([column("title", "text")]),
      onAdd: vi.fn(),
      onCancel,
    });
    const title = screen.getByRole<HTMLInputElement>("textbox", {
      name: "title",
    });
    await userEvent.type(title, "Fictional Beacon");
    await userEvent.keyboard("{Escape}");
    expect([title.value, onCancel.mock.calls.length]).toEqual([
      "Fictional Beacon",
      0,
    ]);
    await userEvent.keyboard("{Escape}");
    expect(onCancel).toHaveBeenCalledOnce();
  });
});

describe("the server's refusal of a value", () => {
  // Adds through the form, giving back what it does with the server's refusal.
  async function refusedBy() {
    const onAdd = vi.fn();
    const shown = renderPanel({
      given: table([column("tick", "flag")]),
      onAdd,
    });
    await add();
    const [, refused] = onAdd.mock.lastCall as [
      unknown,
      (refusal: { reason: string; field: string }) => boolean,
    ];
    return { refused, shown };
  }

  it("is named under its field when the form has it", async () => {
    const { refused } = await refusedBy();
    let named = false;
    act(() => {
      named = refused({ reason: "Taken", field: "tick" });
    });
    expect([named, await screen.findByText("Taken")]).toEqual([
      true,
      expect.anything(),
    ]);
  });

  it("is left for a notification when the form has no such field", async () => {
    const { refused } = await refusedBy();
    expect(refused({ reason: "Taken", field: "elsewhere" })).toBe(false);
  });

  it("is left for a notification once the form has closed", async () => {
    const { refused, shown } = await refusedBy();
    shown.unmount();
    expect(refused({ reason: "Taken", field: "tick" })).toBe(false);
  });
});
