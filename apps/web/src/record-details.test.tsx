// SPDX-License-Identifier: Apache-2.0

// Tests for a record's details: a click anywhere on a row, its label included, opens its editor, as
// its change button does, except a click on a control of its own; a row's colour; and a section
// holding a body other than rows.

import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { describe, expect, it, vi } from "vitest";
import { ColumnRows, RecordSection, Row } from "./record-details.tsx";
import { testTheme, waiting } from "./test-support.tsx";
import { type Gadget, gadget, gadgetTable } from "./test-gadgets.tsx";

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
            scope: "record",
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

describe("a row's colour", () => {
  const renderColoured = (
    colour: string | null,
    changed?: { live: string; liveColour: string | null },
  ) =>
    render(
      <MantineProvider theme={testTheme}>
        <dl>
          <Row
            column={column}
            value="FX-2"
            colour={colour}
            changed={
              changed && {
                ...changed,
                draft: { action: "changed", state: "waiting" },
              }
            }
          />
        </dl>
      </MantineProvider>,
    );
  const squares = () =>
    [...document.querySelectorAll<HTMLElement>("[data-colour]")].map(
      (square) => square.dataset.colour,
    );

  it("draws the value's colour as its square before it", () => {
    renderColoured("grape");
    const [square] = document.querySelectorAll("[data-colour]");
    expect([
      squares(),
      square?.compareDocumentPosition(screen.getByText("FX-2")),
    ]).toEqual([["grape"], Node.DOCUMENT_POSITION_FOLLOWING]);
  });

  it("draws no square for a value with no colour", () => {
    renderColoured(null);
    expect(squares()).toEqual([]);
  });

  it("draws the live value's colour under a draft", () => {
    renderColoured("grape", { live: "FX-1", liveColour: "teal" });
    expect(squares()).toEqual(["grape", "teal"]);
  });

  it("sets a value a draft changes in semibold beside live, and its live value under it not", () => {
    renderColoured(null, { live: "FX-1", liveColour: null });
    expect([
      screen.getByText("FX-2").closest('[class*="changedValue"]') !== null,
      screen.getByText("FX-1").closest('[class*="changedValue"]') !== null,
    ]).toEqual([true, false]);
  });

  it("draws no square beside an empty value or an empty live one", () => {
    render(
      <MantineProvider theme={testTheme}>
        <dl>
          <Row
            column={column}
            value=""
            colour="grape"
            changed={{
              live: "",
              liveColour: "teal",
              draft: { action: "changed", state: "waiting" },
            }}
          />
        </dl>
      </MantineProvider>,
    );
    expect(squares()).toEqual([]);
  });
});

describe("a section of a record's details", () => {
  it("holds a body other than rows, such as a small table, under its heading", () => {
    render(
      <MantineProvider theme={testTheme}>
        <RecordSection id="fictional-parts" title="Parts" body={<table />} />
      </MantineProvider>,
    );

    const section = screen.getByRole("region", { name: "Parts" });
    expect([
      section.querySelector("table") !== null,
      section.querySelector("dl"),
    ]).toEqual([true, null]);
  });
});

describe("the rows of a record's columns", () => {
  it("mark a value another record's draft changes by that draft, not the record's", () => {
    // Given a gadget whose rename was rejected, and whose code another record's waiting draft changes
    const live = { values: {}, links: {} };
    const draft = {
      ...waiting,
      state: "rejected" as const,
      reason: "Fictional reason",
      action: "changed" as const,
      changed: ["name", "code"],
      live: { ...live, name: "Gadget g1", code: "G0" },
    };
    const shown: Gadget = gadget("g1", {
      name: "Renamed",
      draft,
      cellDrafts: new Map([
        [
          "code",
          { ...waiting, action: "changed" as const, changed: ["code"], live },
        ],
      ]),
    });
    render(
      <MantineProvider theme={testTheme}>
        <dl>
          <ColumnRows
            columns={gadgetTable().columnsFor([], [], [], [])}
            shown={shown}
            draft={draft}
            live={gadget("g1")}
            changeOf={() => undefined}
          />
        </dl>
      </MantineProvider>,
    );

    // Then the name is marked rejected and the code waiting
    const [name, code] = screen.getAllByRole("definition");
    expect([
      name?.textContent.includes("Rejected"),
      code?.textContent.includes("Rejected"),
      code?.textContent.includes("Draft: changed"),
    ]).toEqual([true, false, true]);
  });
});

describe("a value of several coloured choices in a panel", () => {
  const teams = {
    key: "teams",
    label: "Feature teams",
    kind: "choice" as const,
    multiple: true,
    required: false,
    emptyLabel: "No feature team",
    choices: [
      { id: "t1", label: "Mobile apps", retired: false, description: "" },
      { id: "t2", label: "Data platform", retired: false, description: "" },
    ],
    choiceColour: (id: string) => (id === "t1" ? "teal" : "grape"),
  };
  const renderTeams = (value: string[]) =>
    render(
      <MantineProvider theme={testTheme}>
        <dl>
          <Row column={teams} value={value} />
        </dl>
      </MantineProvider>,
    );

  it("names each, one to a line, after its square, leaving out one no longer known", () => {
    renderTeams(["t2", "gone", "t1"]);
    const value = screen.getByText("Data platform").closest("dd");
    expect([
      value?.textContent,
      [...(value?.querySelectorAll<HTMLElement>("[data-colour]") ?? [])].map(
        (square) => square.dataset.colour,
      ),
    ]).toEqual(["Data platformMobile apps", ["grape", "teal"]]);
  });

  it("names none by the column's words, with no square", () => {
    renderTeams([]);
    const none = screen.getByText("No feature team").closest("dd");
    expect(none?.querySelector("[data-colour]")).toBeNull();
  });
});
