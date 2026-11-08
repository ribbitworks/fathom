// SPDX-License-Identifier: Apache-2.0

// Tests for the panel that adds a record of the plan: a field for each kind of column, what is
// checked before adding, and what it sends.

import { addressProblem } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { NewPlanRecordPanel } from "./new-plan-record-panel.tsx";
import type { FormValues } from "./new-record-panel.tsx";
import type { PlanChange } from "./project-grids.tsx";
import {
  cellColumn,
  type CellRecord,
  type RecordTable,
} from "./record-grid.tsx";
import { testTheme } from "./test-support.tsx";

const choice = (id: string, label: string, retired = false) => ({
  id,
  label,
  description: "",
  retired,
});

const column = (
  key: string,
  kind: Parameters<typeof cellColumn>[1],
  more: { required?: boolean; multiple?: boolean } = {},
) =>
  cellColumn<CellRecord, PlanChange>(key, kind, {
    label: key,
    required: more.required ?? false,
    multiple: more.multiple ?? false,
    choices: [choice("a", "Alpha"), choice("b", "Gone", true)],
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
  return (
    <NewPlanRecordPanel
      title="New thing"
      table={given}
      records={[]}
      values={values}
      saving={saving}
      narrow={false}
      panelId="panel"
      onValues={setValues}
      onAdd={onAdd}
      onCancel={onCancel}
    />
  );
}

const renderPanel = (props: Parameters<typeof Harness>[0]) =>
  render(
    <MantineProvider theme={testTheme}>
      <Harness {...props} />
    </MantineProvider>,
  );

const field = (key: string) => {
  const found = document.getElementById(`new-plan-record-${key}`);
  if (found === null) throw new Error(`No ${key} field`);
  return found;
};

const add = () => userEvent.click(screen.getByRole("button", { name: "Add" }));

describe("the fields for each kind of column", () => {
  it("sends a picked choice, offering only those not retired, and none once cleared", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("owner", "choice")]), onAdd });
    await userEvent.click(field("owner"));
    const offered = await screen.findByRole("option", { name: "Alpha" });
    expect(screen.queryByRole("option", { name: "Gone" })).toBeNull();
    await userEvent.click(offered);
    await add();
    expect(onAdd).toHaveBeenLastCalledWith({ values: { owner: ["a"] } });
    await userEvent.click(field("owner"));
    await userEvent.click(await screen.findByRole("option", { name: "Alpha" }));
    await add();
    expect(onAdd).toHaveBeenLastCalledWith({ values: { owner: [] } });
  });

  it("sends several picked choices", async () => {
    const onAdd = vi.fn();
    renderPanel({
      given: table([column("tags", "choice", { multiple: true })]),
      onAdd,
    });
    await userEvent.click(field("tags"));
    await userEvent.click(await screen.findByRole("option", { name: "Alpha" }));
    await add();
    expect(onAdd).toHaveBeenCalledWith({ values: { tags: ["a"] } });
  });

  it("sends a web link by its address, and none once emptied", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("site", "link")]), onAdd });
    const box = screen.getByRole<HTMLInputElement>("textbox", { name: "site" });
    await userEvent.type(box, "https://example.test");
    expect(box.value).toBe("https://example.test");
    await add();
    expect(onAdd).toHaveBeenLastCalledWith({
      links: {
        site: { address: "https://example.test", text: "" },
      },
    });
    await userEvent.clear(box);
    await add();
    expect(onAdd).toHaveBeenLastCalledWith({ links: { site: null } });
  });

  it("names a web address it cannot keep, adding nothing", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("site", "link")]), onAdd });
    await userEvent.type(
      screen.getByRole("textbox", { name: "site" }),
      "not an address",
    );
    await add();
    expect(screen.getByText(addressProblem)).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("empties a field from its clear button", async () => {
    renderPanel({
      given: table([column("name", "text"), column("site", "link")]),
      onAdd: vi.fn(),
    });
    const name = screen.getByRole<HTMLInputElement>("textbox", {
      name: "name",
    });
    const site = screen.getByRole<HTMLInputElement>("textbox", {
      name: "site",
    });
    await userEvent.type(name, "Words");
    await userEvent.type(site, "https://example.test");
    await userEvent.click(screen.getByRole("button", { name: "Clear name" }));
    await userEvent.click(screen.getByRole("button", { name: "Clear site" }));
    expect(name.value).toBe("");
    expect(site.value).toBe("");
  });

  it("sends a tick, and takes it away", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("done", "flag")]), onAdd });
    const box = screen.getByRole("checkbox", { name: "done" });
    await userEvent.click(box);
    await add();
    expect(onAdd).toHaveBeenLastCalledWith({ done: true });
    await userEvent.click(box);
    await add();
    expect(onAdd).toHaveBeenLastCalledWith({ done: false });
  });

  it("says an unfinished date is not a date", async () => {
    const onAdd = vi.fn();
    renderPanel({
      given: table([column("when", "date", { required: true })]),
      onAdd,
    });
    await userEvent.type(screen.getByRole("textbox", { name: /^when/ }), "20");
    await add();
    expect(screen.getByText("Use a date such as 2026-10-31")).toBeTruthy();
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("shows no field for a kind a new record cannot be given here", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("words", "note")]), onAdd });
    expect(screen.queryByRole("textbox")).toBeNull();
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

  it("adds the record when Enter is pressed in a field", async () => {
    const onAdd = vi.fn();
    renderPanel({ given: table([column("name", "text")]), onAdd });
    await userEvent.type(
      screen.getByRole("textbox", { name: "name" }),
      "Words{Enter}",
    );
    expect(onAdd).toHaveBeenCalledOnce();
  });

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
