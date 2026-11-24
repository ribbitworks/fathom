// SPDX-License-Identifier: Apache-2.0

// Tests for planned hires beside people in the People table.

import type { List, Person } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { act, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { type Column, columnsFor, PeopleGrid } from "./people-grid.tsx";
import { emptyView } from "./table-view.ts";
import { testTheme } from "./test-support.tsx";
import { site, positions, noop, actions } from "./test-people-grid.tsx";

describe("planned hires beside people", () => {
  const states: List = {
    id: "states",
    keyNumber: 1,
    name: "Hiring states",
    description: "",
    visibility: "general",
    retired: false,
    builtIn: "hiring-states",
    choices: [
      {
        id: "s-proposed",
        label: "Request to hire",
        description: "",
        retired: false,
        meaning: "proposed",
      },
      {
        id: "s-hired",
        label: "Hired",
        description: "",
        retired: false,
        meaning: "hired",
      },
      {
        id: "s-left",
        label: "Fictional Resigned",
        description: "",
        retired: false,
        meaning: "left",
      },
    ],
  };
  const rows: Person[] = [
    {
      id: "p1",
      keyNumber: 1,
      preferredName: "Avery Fictional",
      employeeId: "E1",
      positionId: "position-1",
      stateId: "s-hired",
      values: {},
      links: {},
    },
    {
      id: "h1",
      keyNumber: 1,
      kind: "planned-hire",
      preferredName: "",
      employeeId: "TBD-1",
      positionId: "position-1",
      stateId: "s-proposed",
      expected: "2027-03",
      values: {},
      links: {},
    },
  ];

  it("leaves the Expected month empty for a hire with no date, since it moves with the day shown", () => {
    const undated = {
      ...(rows[1] as Person),
      id: "h2",
      undated: true as const,
    };
    const expected = columnsFor([], [positions], [], true, [
      ...rows,
      undated,
    ]).find((column) => column.key === "expected") as Column;
    expect(expected.value(rows[1] as Person)).toEqual(["2027-03"]);
    expect(expected.value(undated)).toEqual([]);
    expect(expected.choices.map(({ id }) => id)).toEqual(["2027-03"]);
  });

  it("offers a hire the added columns switched on for planned hires, never required of it", () => {
    const required = { ...site, required: true };
    const off = { ...site, id: "f2", name: "Office", onPlannedHires: false };
    const [offered, notOffered] = ["f1", "f2"].map(
      (key) =>
        columnsFor([required, off], [positions], [], true, rows).find(
          (column) => column.key === key,
        ) as Column,
    );
    expect(offered?.offeredOn?.("planned-hire") ?? true).toBe(true);
    expect(offered?.requiredOn?.("planned-hire")).toBe(false);
    expect(offered?.requiredOn?.("person")).toBe(true);
    expect(notOffered?.offeredOn?.("planned-hire")).toBe(false);
    expect(notOffered?.offeredOn?.("person")).toBe(true);
  });

  it("offers a hire a column by its live setting while a draft switches it", () => {
    const draft = {
      action: "changed" as const,
      changed: ["onPlannedHires"],
      state: "waiting" as const,
      madeBy: null,
      madeAt: null,
    };
    const switchingOn = {
      ...site,
      draft: { ...draft, live: { onPlannedHires: false } },
    };
    const added = {
      ...site,
      id: "f2",
      name: "Office",
      draft: { ...draft, action: "created" as const, changed: [], live: {} },
    };
    const [live, drafted] = ["f1", "f2"].map(
      (key) =>
        columnsFor([switchingOn, added], [positions], [], true, rows).find(
          (column) => column.key === key,
        ) as Column,
    );
    expect(live?.offeredOn?.("planned-hire")).toBe(false);
    expect(drafted?.offeredOn?.("planned-hire") ?? true).toBe(true);
  });

  it("offers a person states of the meaning they show, a new person Hired or Left, and a hire only Proposed or Open", () => {
    const state = columnsFor([], [positions, states], [], true, rows).find(
      ({ key }) => key === "stateId",
    ) as Column;
    const offered = (record: Person | undefined, kind: string) =>
      states.choices
        .filter((option) => state.pickableOn?.(option, record, kind))
        .map(({ id }) => id);
    expect(state.readOnlyOn).toBeUndefined();
    expect(offered(rows[0], "person")).toEqual(["s-hired"]);
    expect(
      offered({ ...(rows[0] as Person), stateId: "s-left" }, "person"),
    ).toEqual(["s-left"]);
    expect(offered(undefined, "person")).toEqual(["s-hired", "s-left"]);
    expect(offered(rows[1], "planned-hire")).toEqual(["s-proposed"]);
    expect(state.newRowValue?.("planned-hire")).toEqual(["s-proposed"]);
    expect(state.newRowValue?.("person")).toEqual(["s-hired"]);
    expect(state.required).toBe(true);
    const proposedOnly = { ...states, choices: states.choices.slice(0, 1) };
    const bare = columnsFor([], [positions, proposedOnly], [], true, rows).find(
      ({ key }) => key === "stateId",
    ) as Column;
    expect(bare.newRowValue?.("person")).toEqual([]);
  });

  it("shows the month a hire is expected, which nobody changes, and refuses a typed ID that looks temporary", async () => {
    const expected = columnsFor([], [positions, states], [], true, rows).find(
      ({ key }) => key === "expected",
    ) as Column;
    expect(expected.choices.map(({ label }) => label)).toEqual(["Mar 2027"]);
    expect(
      expected.live({
        action: "changed",
        changed: [],
        live: { values: {}, links: {} },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      }),
    ).toEqual([]);
    expect(expected.change(["2027-03"])).toEqual({});
    render(
      <MantineProvider theme={testTheme}>
        <PeopleGrid
          people={rows}
          fields={[]}
          order={[]}
          lists={[positions, states]}
          canEdit
          canEditColumns={false}
          canEditHires
          showDates
          view={emptyView}
          onView={noop}
          actions={actions}
        />
      </MantineProvider>,
    );
    act(() => {
      document.getElementById("cell-p1-employeeId")?.focus();
    });
    await userEvent.keyboard("tbd-5{Enter}");
    expect(screen.getByRole("alert").textContent).toBe(
      "An ID cannot start with TBD-, which temporary IDs use",
    );
  });

  it.each([
    ["one of each", [0, 1], "1 person and 1 planned hire"],
    ["planned hires alone", [1, 1], "2 planned hires"],
    ["people alone", [0, 0], "2 people"],
  ])(
    "counts %s by kind, above the table and in Metrics",
    (_case, picked, line) => {
      render(
        <MantineProvider theme={testTheme}>
          <PeopleGrid
            people={picked.map((index, at) => ({
              ...(rows.at(index) as Person),
              id: `r${String(at)}`,
              employeeId: `X${String(at)}`,
            }))}
            fields={[]}
            order={[]}
            lists={[positions, states]}
            canEdit={false}
            canEditColumns={false}
            showDates
            view={{ ...emptyView, breakdown: ["positionId"] }}
            onView={noop}
            actions={actions}
          />
        </MantineProvider>,
      );
      const panel = screen.getByRole("region", { name: "Metrics" });
      expect(panel.textContent).toContain(line);
      expect(
        screen.getAllByRole("status").map(({ textContent }) => textContent),
      ).toContain(line);
      expect(
        within(panel)
          .getAllByRole("columnheader")
          .map((th) => th.textContent),
      ).toContain("Count");
    },
  );

  it("names a hire by its live position and ID on its Live row while a draft names it", () => {
    const named: Person = {
      ...(rows[1] as Person),
      preferredName: "Fictional test lead",
      draft: {
        action: "changed",
        changed: ["preferredName"],
        live: { preferredName: "", values: {}, links: {} },
        state: "waiting",
        madeBy: null,
        madeAt: null,
      },
    };
    render(
      <MantineProvider theme={testTheme}>
        <PeopleGrid
          people={[named]}
          fields={[]}
          order={[]}
          lists={[positions, states]}
          canEdit
          canEditColumns={false}
          canEditHires
          showDates
          view={emptyView}
          onView={noop}
          actions={actions}
        />
      </MantineProvider>,
    );
    expect(
      document.getElementById("cell-h1-preferredName")?.textContent,
    ).toContain("Fictional test lead");
    const liveRow = document.querySelector("tr[aria-hidden='true']");
    expect(liveRow?.querySelector("td")?.textContent).toBe(
      "Fictional Engineer, TBD-1, live",
    );
  });

  it("names a hire with no name by its position and ID, which sorts it", () => {
    render(
      <MantineProvider theme={testTheme}>
        <PeopleGrid
          people={rows}
          fields={[]}
          order={[]}
          lists={[positions, states]}
          canEdit
          canEditColumns={false}
          canEditHires
          showDates
          view={{
            ...emptyView,
            sort: [{ key: "preferredName", descending: true }],
          }}
          onView={noop}
          actions={actions}
        />
      </MantineProvider>,
    );
    const nameCell = document.getElementById("cell-h1-preferredName");
    expect(nameCell?.textContent).toBe("Fictional Engineer, TBD-1");
    expect(
      document.getElementById("cell-p1-stateId")?.getAttribute("aria-readonly"),
    ).toBeNull();
    expect(
      document.getElementById("cell-h1-stateId")?.getAttribute("aria-readonly"),
    ).toBeNull();
    const names = [...document.querySelectorAll("[id$='-preferredName']")]
      .map((cell) => cell.id)
      .filter((id) => !id.includes("new"));
    expect(names).toEqual(["cell-h1-preferredName", "cell-p1-preferredName"]);
  });
});
