// SPDX-License-Identifier: Apache-2.0

// Tests for changing and pasting managers, teams and Manager? in the People table, and their
// refusals.

import { act, render, screen, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { formatDay } from "./day-formats.ts";
import {
  grid,
  lead,
  people,
  peopleActions,
  person,
  text,
} from "./test-people-grid.tsx";

describe("managers and teams", () => {
  const focus = (row: string, key: string) => {
    act(() => {
      document.getElementById(`cell-${row}-${key}`)?.focus();
    });
  };

  it("changes a person's manager, offering No manager first and only those still employed, and clears it with Delete", async () => {
    const update = vi.fn();
    render(grid({ actions: peopleActions({ update }) }));
    focus("p2", "managerId");
    await userEvent.keyboard("{Enter}");
    const options = await screen.findAllByRole("option");
    expect(
      options.map((option) => option.querySelector("span")?.textContent),
    ).toEqual([
      "No manager",
      "Fictional p1",
      "Fictional p2",
      "Fictional p4",
      "Fictional p5",
    ]);
    await userEvent.click(
      screen.getByRole("option", { name: /^Fictional p4\b/ }),
    );
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p2" }),
      { managerId: "p4" },
    );
    focus("p2", "managerId");
    await userEvent.keyboard("{Delete}");
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p2" }),
      { managerId: null },
    );
  });

  it("describes each manager offered by position, then the team they are on or whom they report to, so two with the same name are told apart", async () => {
    // Given a second manager with the name of the one at the top
    const namesake = person("p6", {
      preferredName: "Fictional p1",
      manager: lead("p2"),
      team: null,
    });
    render(grid({ people: [...people, namesake] }));
    // When a person's Manager cell is opened
    focus("p2", "managerId");
    await userEvent.keyboard("{Enter}");
    // Then each manager shows their position, then the team they are on or whom they report to
    const options = await screen.findAllByRole("option");
    expect(
      options.map((option) =>
        [...option.querySelectorAll("span, p")].map(
          ({ textContent }) => textContent,
        ),
      ),
    ).toEqual([
      ["No manager"],
      ["Fictional p1", "Fictional Engineer"],
      ["Fictional p1", "Fictional Engineer, reports to Fictional p2"],
      ["Fictional p2", "Fictional Engineer, Harbour Crew"],
      ["Fictional p4", "Fictional Engineer, reports to Fictional p3"],
      // A team this reader isn't sent is left out.
      ["Fictional p5", "Fictional Engineer"],
    ]);
  });

  it("refuses a pasted manager's name that more than one manager has, rather than taking the first", async () => {
    const add = vi.fn();
    const namesake = person("p6", {
      preferredName: "Fictional p1",
      manager: lead("p2"),
      team: null,
    });
    render(
      grid({
        people: [...people, namesake],
        actions: peopleActions({ add }),
        order: ["preferredName", "employeeId", "positionId", "managerId"],
      }),
    );
    focus("new-0", "preferredName");
    await userEvent.paste("Fictional p7\tp7\tFictional Engineer\tFictional p1");
    expect(add).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "More than one Manager is called Fictional p1",
    );
  });

  it("takes a pasted manager's name that only someone who has left also has", async () => {
    const add = vi.fn();
    const gone = person("p6", {
      preferredName: "Fictional p1",
      endDate: "2020-01-31",
      manager: lead("p2"),
      team: null,
    });
    render(
      grid({
        people: [...people, gone],
        actions: peopleActions({ add }),
        order: ["preferredName", "employeeId", "positionId", "managerId"],
      }),
    );
    focus("new-0", "preferredName");
    await userEvent.paste("Fictional p7\tp7\tFictional Engineer\tFictional p1");
    expect(screen.queryByRole("alert")).toBeNull();
    expect(add).toHaveBeenCalled();
  });

  it("keeps the Team column read only, since a team follows from its manager", async () => {
    const update = vi.fn();
    render(grid({ actions: peopleActions({ update }) }));
    focus("p2", "team");
    await userEvent.keyboard("{Enter}x{Delete}");
    expect(screen.queryByRole("option")).toBeNull();
    expect(within(screen.getByRole("grid")).queryByRole("textbox")).toBeNull();
    expect(update).not.toHaveBeenCalled();
    expect(
      document.getElementById("cell-p2-team")?.getAttribute("aria-readonly"),
    ).toBe("true");
  });

  it("names a team, and moves the date a manager is someone's from, but never clears that date", async () => {
    const update = vi.fn();
    render(grid({ actions: peopleActions({ update }) }));
    focus("p1", "teamName");
    await userEvent.keyboard("{Enter}{Control>}a{/Control}Quay Crew{Enter}");
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p1" }),
      { teamName: "Quay Crew" },
    );
    focus("p4", "managerFrom");
    await userEvent.keyboard("{Enter}{Control>}a{/Control}2024-03-01{Enter}");
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p4" }),
      { managerFrom: "2024-03-01" },
    );
    update.mockClear();
    focus("p4", "managerFrom");
    await userEvent.keyboard("{Delete}");
    expect(update).not.toHaveBeenCalled();
    expect(text("p4", "managerFrom")).toBe(formatDay("2024-02-01"));
    await userEvent.keyboard("{Enter}{Control>}a{/Control}{Backspace}{Enter}");
    expect(screen.getByRole("alert").textContent).toBe("Date needed");
    expect(update).not.toHaveBeenCalled();
  });

  it("checks and unchecks Manager? with one click, Space, or Enter, but not by typing", async () => {
    const update = vi.fn();
    render(
      grid({
        people: [person("p1", { isManager: false }), person("p2")],
        actions: peopleActions({ update }),
      }),
    );
    await userEvent.click(
      document.getElementById("cell-p1-isManager") as HTMLElement,
    );
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p1" }),
      { isManager: true },
    );
    focus("p2", "isManager");
    await userEvent.keyboard(" ");
    expect(update).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "p2" }),
      { isManager: false },
    );
    await userEvent.keyboard("{Enter}");
    expect(update).toHaveBeenCalledTimes(3);
    await userEvent.keyboard("y");
    expect(update).toHaveBeenCalledTimes(3);
    await userEvent.dblClick(
      document.getElementById("cell-p2-isManager") as HTMLElement,
    );
    expect(update).toHaveBeenCalledTimes(5);
    expect(document.getElementById("cell-p2-isManager-editor")).toBeNull();
  });

  it("adds people pasted as managers or not, and refuses a Manager? that is neither", async () => {
    const add = vi.fn();
    render(
      grid({
        actions: peopleActions({ add }),
        order: ["preferredName", "employeeId", "positionId", "isManager"],
      }),
    );
    focus("new-0", "preferredName");
    await userEvent.paste(
      "Fictional p6\tp6\tFictional Engineer\tYes\nFictional p7\tp7\tFictional Engineer\tno",
    );
    const requests = (add.mock.calls[0]?.[0] ?? []) as {
      request: { isManager?: boolean };
    }[];
    expect(requests.map(({ request }) => request.isManager)).toEqual([
      true,
      undefined,
    ]);
    focus("new-0", "preferredName");
    await userEvent.paste("Fictional p8\tp8\tFictional Engineer\tmaybe");
    expect(add).toHaveBeenCalledTimes(1);
    expect(document.body.textContent).toContain("Manager?: use Yes or No");
  });

  it("adds people with managers pasted by name, and their team's name, but not a team pasted", async () => {
    const add = vi.fn();
    render(
      grid({
        actions: peopleActions({ add }),
        order: [
          "preferredName",
          "employeeId",
          "positionId",
          "managerId",
          "team",
          "teamName",
          "managerFrom",
        ],
      }),
    );
    focus("new-0", "preferredName");
    await userEvent.paste(
      "Fictional p6\tp6\tFictional Engineer\tFictional p1\tHarbour Crew\tQuay Crew\t2024-05-01\nFictional p7\tp7\tFictional Engineer\tFictional p2",
    );
    expect(add).toHaveBeenCalledWith(
      [
        {
          id: expect.stringMatching(/^pending-/) as string,
          request: {
            preferredName: "Fictional p6",
            employeeId: "p6",
            positionId: "position-1",
            startDate: null,
            endDate: null,
            managerId: "p1",
            managerFrom: "2024-05-01",
            teamName: "Quay Crew",
            values: {},
            links: {},
          },
        },
        {
          id: expect.stringMatching(/^pending-/) as string,
          request: {
            preferredName: "Fictional p7",
            employeeId: "p7",
            positionId: "position-1",
            startDate: null,
            endDate: null,
            managerId: "p2",
            values: {},
            links: {},
          },
        },
      ],
      expect.any(Function),
      expect.any(Function),
    );
  });

  it("refuses Manager assigned for someone with no manager and no line, but moves a line with no manager", async () => {
    const update = vi.fn();
    render(
      grid({
        actions: peopleActions({ update }),
        people: [
          ...people,
          person("p6", { manager: null, managerFrom: "2024-03-01" }),
        ],
      }),
    );
    focus("p1", "managerFrom");
    await userEvent.keyboard("{Enter}2024-05-01{Enter}");
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose a manager, or leave Manager assigned empty",
    );
    expect(update).not.toHaveBeenCalled();
    await userEvent.keyboard("{Escape}");
    focus("p6", "managerFrom");
    await userEvent.keyboard("{Enter}{Control>}a{/Control}2024-04-01{Enter}");
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ id: "p6" }), {
      managerFrom: "2024-04-01",
    });
  });

  it("refuses a new person's Manager assigned without a manager", async () => {
    const add = vi.fn();
    render(
      grid({
        actions: peopleActions({ add }),
        order: ["preferredName", "employeeId", "managerFrom"],
      }),
    );
    focus("new-0", "preferredName");
    await userEvent.paste("Fictional p6\tp6\t2024-05-01");
    expect(add).not.toHaveBeenCalled();
    expect(screen.getByRole("alert").textContent).toBe(
      "Choose a manager, or leave Manager assigned empty",
    );
  });
});
