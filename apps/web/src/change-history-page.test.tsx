// SPDX-License-Identifier: Apache-2.0

// Tests for the Change history page, with the server's responses simulated: who sees it, how each
// change is put in words, reading older changes, and the messages while it loads or when it cannot
// be loaded.

import type { ChangedRecord, ChangeEntry } from "@fathom/shared";
import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fictionalUser,
  greeting,
  renderApp,
  serverAnswers,
  signedIn,
} from "./test-support.tsx";

const changesViewer = () =>
  Response.json({
    ...fictionalUser,
    permissions: ["plan:view", "changes:view"],
  });

const older = "6f9619ff-8b86-4011-b42d-00c04fc964ff";

let entryCount = 0;
function entry(
  records: ChangedRecord[],
  madeBy: string | null = "Fictional Person",
  kind: ChangeEntry["kind"] = "edit",
): ChangeEntry {
  entryCount += 1;
  return {
    id: `00000000-0000-4000-8000-${String(entryCount).padStart(12, "0")}`,
    kind,
    madeAt: "2026-10-30T15:00:00.000Z",
    madeBy,
    records,
  };
}

const record = (
  kind: string,
  action: string,
  fields: ChangedRecord["fields"] = [],
  name: string | null = "Fictional",
  list: string | null = null,
  draft = false,
): ChangedRecord => ({ kind, action, name, list, fields, draft });

const page =
  (entries: ChangeEntry[], next: string | null = null) =>
  () =>
    Response.json({ entries, next });

// Each entry, the row its date and time begin.
async function rows(): Promise<HTMLElement[]> {
  await screen.findAllByRole("listitem");
  return [...document.querySelectorAll("time")].map(
    (time) => time.closest("li") as HTMLElement,
  );
}

// Each entry's words, without its date and time, whose format depends on the computer's settings.
async function lines(): Promise<string[]> {
  return (await rows()).map((item) =>
    item.textContent.slice(
      String(item.querySelector("time")?.textContent).length,
    ),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("who sees the Change history page", () => {
  it("links to it for users who may view the change history", async () => {
    serverAnswers({
      "GET /api/session": changesViewer,
      "GET /api/greeting": greeting,
      "GET /api/changes": page([]),
    });
    renderApp("/");
    await userEvent.click(
      await screen.findByRole("link", { name: "Change history" }),
    );
    expect(
      await screen.findByRole("heading", { name: "Change history" }),
    ).toBeDefined();
    expect(
      await screen.findByText("No changes to data you can see yet."),
    ).toBeDefined();
  });

  it("neither links to it nor shows it to anyone else", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/greeting": greeting,
    });
    renderApp("/changes");
    expect(
      await screen.findByText("There is no page at this address."),
    ).toBeDefined();
    expect(screen.queryByRole("link", { name: "Change history" })).toBeNull();
  });
});

describe("the entries", () => {
  it("say what was drafted, approved, rejected, and discarded", async () => {
    const name = { field: "preferredName", oldValue: "A", newValue: "B" };
    const drafted = (action: string, fields: object[] = []) =>
      record("person", action, fields as never, "Avery Fictional", null, true);
    serverAnswers({
      "GET /api/session": changesViewer,
      "GET /api/changes": page([
        entry([drafted("created")]),
        entry([drafted("deleted")]),
        entry([drafted("changed", [name])]),
        entry([drafted("created"), drafted("created")]),
        entry(
          [
            record("person", "created", [], "Avery Fictional"),
            record("person", "deleted", [], "Blake Fictional"),
            record("person", "changed", [name], "Casey Fictional"),
          ],
          "Fictional Approver",
          "approval",
        ),
        entry(
          [
            drafted("changed", [
              {
                field: "rejected",
                oldValue: null,
                newValue: "Fictional reason",
              },
            ]),
            drafted("changed", [
              { field: "rejected", oldValue: null, newValue: null },
            ]),
          ],
          "Fictional Approver",
          "rejection",
        ),
        entry(
          [drafted("changed", [name]), drafted("deleted")],
          "Fictional Person",
          "discard",
        ),
        entry([drafted("changed")], "Fictional Person", "resubmission"),
        entry(
          [drafted("changed"), drafted("changed")],
          "Fictional Person",
          "resubmission",
        ),
        entry([
          record("list-item", "created", [], "North", "Sites"),
          record("list-item", "created", [], "South", "Sites"),
        ]),
      ]),
    });
    renderApp("/changes");
    expect(await lines()).toEqual([
      "Fictional Person drafted adding Avery Fictional",
      "Fictional Person drafted removing Avery Fictional",
      "Fictional Person drafted changes to Avery Fictional: Name from A to B",
      "Fictional Person drafted adding 2 people: Avery Fictional, Avery Fictional",
      "Fictional Approver approved 3 draftsApproved adding Avery FictionalApproved removing Blake FictionalApproved changes to Casey Fictional: Name from A to B",
      "Fictional Approver rejected 2 draftsRejected the draft of Avery Fictional: Reason: Fictional reasonRejected the draft of Avery Fictional",
      "Fictional Person discarded 2 draftsDiscarded the draft of Avery FictionalDiscarded the draft of Avery Fictional",
      "Fictional Person sent the draft of Avery Fictional for approval again",
      "Fictional Person sent 2 drafts for approval againSent the draft of Avery Fictional for approval againSent the draft of Avery Fictional for approval again",
      "Fictional Person added 2 choices to Sites: North, South",
    ]);
  });

  it("say who changed what, and what changed in it", async () => {
    serverAnswers({
      "GET /api/session": changesViewer,
      "GET /api/changes": page([
        entry([
          record(
            "person",
            "changed",
            [
              {
                field: "preferredName",
                oldValue: "Avery",
                newValue: "Avery Fictional",
              },
              {
                field: "value",
                column: "Site",
                oldValue: ["North"],
                newValue: ["North", "South"],
              },
              { field: "endDate", oldValue: null, newValue: "2030-01-31" },
              { field: "employeeId", oldValue: null, newValue: null },
              { field: "value", oldValue: ["North"], newValue: [] },
            ],
            "Avery Fictional",
          ),
        ]),
        entry(
          [
            record(
              "list",
              "changed",
              [
                {
                  field: "visibility",
                  oldValue: "general",
                  newValue: "restricted",
                },
                { field: "description", oldValue: "Where", newValue: null },
                { field: "retired", oldValue: false, newValue: true },
                { field: "visibility", oldValue: null, newValue: "secret" },
              ],
              "Sites",
            ),
          ],
          null,
        ),
        entry([record("list", "created", [], "Sites")]),
        entry([record("person", "deleted", [], null)]),
        entry([
          record(
            "list-item",
            "changed",
            [{ field: "retired", oldValue: true, newValue: false }],
            "North",
            "Sites",
          ),
        ]),
        entry([
          record(
            "list-item",
            "changed",
            [{ field: "retired", oldValue: false, newValue: true }],
            "North",
          ),
        ]),
        entry([
          record(
            "list-item",
            "changed",
            [{ field: "order", oldValue: "South", newValue: null }],
            "North",
            "Sites",
          ),
        ]),
        entry([
          record(
            "list-item",
            "changed",
            [{ field: "order", oldValue: null, newValue: "South" }],
            "North",
            "Sites",
          ),
        ]),
        entry([
          record(
            "field",
            "changed",
            [
              { field: "multiple", oldValue: false, newValue: true },
              { field: "listId", oldValue: "Sites", newValue: "Places" },
              { field: "someday", oldValue: "a", newValue: "b" },
            ],
            "Site",
          ),
        ]),
        entry([
          record("column-order", "changed", [
            {
              field: "order",
              oldValue: ["Name", "Employee ID", "Site"],
              newValue: ["Site", "Name", "Employee ID"],
            },
          ]),
        ]),
        entry([
          record("column-order", "changed", [
            {
              field: "order",
              oldValue: ["Name", "Site", "Employee ID", "Level"],
              newValue: ["Name", "Employee ID", "Level", "Site"],
            },
          ]),
        ]),
        entry([
          record("column-order", "changed", [
            {
              field: "order",
              oldValue: ["Name", "Site", "Employee ID", "Level"],
              newValue: ["Site", "Name", "Level", "Employee ID"],
            },
          ]),
        ]),
        entry([
          record("column-order", "changed", [
            { field: "order", oldValue: null, newValue: ["Name"] },
          ]),
        ]),
        entry([
          record(
            "saved-view",
            "changed",
            [{ field: "definition", oldValue: null, newValue: null }],
            "Leaving",
          ),
        ]),
        entry([record("saved-view", "created", [], null)]),
        entry([record("future-kind", "created")]),
      ]),
    });
    renderApp("/changes");
    expect(await lines()).toEqual([
      "Fictional Person changed Avery Fictional: Name from Avery to Avery Fictional; Site from North to North, South; End set to Jan 31, 2030; Employee ID changed; A deleted column cleared, from North",
      "Fathom changed the list Sites: Visibility from Everyone to Restricted; Description cleared, from Where; Retired from No to Yes; Visibility set to secret",
      "Fictional Person added the list Sites",
      "Fictional Person deleted a person",
      "Fictional Person restored the choice North in Sites",
      "Fictional Person retired the choice North",
      "Fictional Person moved the choice North in Sites to the top",
      "Fictional Person moved the choice North in Sites after South",
      "Fictional Person changed the column Site: Several choices from No to Yes; List from Sites to Places; someday from a to b",
      "Fictional Person moved the column Site to the start",
      "Fictional Person moved the column Site after Level",
      "Fictional Person changed the order of People's columns",
      "Fictional Person changed the order of People's columns",
      "Fictional Person changed the view Leaving: Filters and sort changed",
      "Fictional Person added the view without a name",
      "Fictional Person added a record",
    ]);
  });

  it("put records added or deleted together in one line, naming them, with the rest on request", async () => {
    const people = "ABCDEFGHIJKL"
      .split("")
      .map((name) => record("person", "created", [], `Fictional ${name}`));
    const renamed = ["P", "Q", "R", "S", "T", "U"].map((name) =>
      record(
        "list",
        "changed",
        [{ field: "name", oldValue: name, newValue: `${name}2` }],
        `${name}2`,
      ),
    );
    serverAnswers({
      "GET /api/session": changesViewer,
      "GET /api/changes": page([
        entry([...people, ...renamed]),
        entry([
          record("list-item", "created", [], "North", "Sites"),
          record("list-item", "created", [], "South", "Sites"),
          record("list-item", "deleted", [], "Low", "Levels"),
          record("list-item", "deleted", [], null, "Levels"),
          record("future-kind", "created"),
          record("future-kind", "created"),
        ]),
        entry([
          record("list-item", "created", [], "North", "Sites"),
          record("list-item", "created", [], "Low", "Levels"),
          record("list-item", "deleted", [], "East", null),
          record("list-item", "deleted", [], "West", null),
        ]),
      ]),
    });
    renderApp("/changes");
    const [first, second, third] = (await rows()) as [
      HTMLElement,
      HTMLElement,
      HTMLElement,
    ];
    expect(first.textContent).toContain(
      "Fictional Person saved changes to 18 records",
    );
    expect(within(first).getAllByRole("listitem")).toHaveLength(5);
    const [group] = within(first).getAllByRole("listitem") as [HTMLElement];
    expect(group.textContent).toBe(
      "Added 12 people: Fictional A, Fictional B, Fictional C, Fictional D, Fictional E, Fictional F, Fictional G, Fictional H, Fictional I, Fictional J and 2 more Show all",
    );
    await userEvent.click(
      within(group).getByRole("button", { name: "Show all" }),
    );
    expect(group.textContent).toContain("Fictional K, Fictional L Show fewer");
    await userEvent.click(
      within(group).getByRole("button", { name: "Show fewer" }),
    );
    expect(group.textContent).toContain("and 2 more");
    await userEvent.click(
      within(first).getByRole("button", { name: "Show 2 more" }),
    );
    expect(within(first).getAllByRole("listitem")).toHaveLength(7);
    await userEvent.click(
      within(first).getByRole("button", { name: "Show fewer" }),
    );
    expect(within(first).getAllByRole("listitem")).toHaveLength(5);
    expect(
      within(second)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual([
      "Added 2 choices to Sites: North, South",
      "Deleted 2 choices from Levels: Low, unnamed",
      "Added 2 records: Fictional, Fictional",
    ]);
    expect(
      within(third)
        .getAllByRole("listitem")
        .map((item) => item.textContent),
    ).toEqual(["Added 2 choices: North, Low", "Deleted 2 choices: East, West"]);
  });

  it("show each entry's date and time, newest first, with older ones on request", async () => {
    const latest = { ...entry([record("list", "created", [], "Sites")]) };
    const earlier = {
      ...entry([record("list", "created", [], "Levels")]),
      madeAt: "2026-10-29T12:00:00.000Z",
    };
    serverAnswers({
      "GET /api/session": changesViewer,
      "GET /api/changes": page([latest], older),
      [`GET /api/changes?before=${older}`]: page([earlier]),
    });
    renderApp("/changes");
    expect(await lines()).toEqual(["Fictional Person added the list Sites"]);
    await userEvent.click(screen.getByRole("button", { name: "Show more" }));
    expect(
      await screen.findByText("added the list Levels", { exact: false }),
    ).toBeDefined();
    expect(
      [...document.querySelectorAll("time")].map((time) => time.dateTime),
    ).toEqual([latest.madeAt, earlier.madeAt]);
    expect((await rows())[1]?.textContent).toMatch(/2026/);
    expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
  });

  it("are searched on the server, keeping the search in the address", async () => {
    const sites = entry([record("list", "created", [], "Sites")]);
    const fetch = serverAnswers({
      "GET /api/session": changesViewer,
      "GET /api/changes": page([sites]),
      "GET /api/changes?search=S%C3%ADtes": page([sites]),
      "GET /api/changes?search=nothing": page([]),
    });
    const history = renderApp("/changes");
    const field = await screen.findByRole("textbox", {
      name: "Search change history",
    });
    await screen.findByText("added the list Sites", { exact: false });
    await userEvent.type(field, "Sítes");
    // A spinner shows until typing pauses and the search is read.
    expect(screen.getByRole("status", { name: "Searching" })).toBeDefined();
    await waitFor(() => {
      expect(fetch).toHaveBeenCalledWith(
        "/api/changes?search=S%C3%ADtes",
        expect.anything(),
      );
    });
    expect(fetch).not.toHaveBeenCalledWith(
      "/api/changes?search=S",
      expect.anything(),
    );
    expect(history.location.search).toBe("?search=S%C3%ADtes");
    await userEvent.clear(field);
    await userEvent.type(field, "nothing");
    expect(
      await screen.findByText("No changes match the search."),
    ).toBeDefined();
    await userEvent.keyboard("{Escape}");
    expect(history.location.search).toBe("");
    await userEvent.keyboard("{Escape}");
    expect(document.activeElement).not.toBe(field);
  });

  it("show what matches a search first, so it is never only behind Show all or Show more", async () => {
    const people = [
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "Zed",
    ].map((name) => record("person", "created", [], `Fictional ${name}`));
    const renamed = ["P", "Q", "R", "S", "T", "U"].map((name) =>
      record(
        "list",
        "changed",
        [{ field: "name", oldValue: name, newValue: `${name}2` }],
        `${name}2`,
      ),
    );
    serverAnswers({
      "GET /api/session": changesViewer,
      "GET /api/changes?search=zed": page([entry([...renamed, ...people])]),
    });
    renderApp("/changes?search=zed");
    const [row] = (await rows()) as [HTMLElement];
    const [first] = within(row).getAllByRole("listitem") as [HTMLElement];
    expect(first.textContent).toMatch(
      /^Added 12 people: Fictional Zed, Fictional A,/,
    );
  });

  it("show first a line matching a search on a value as stored, such as a date as typed", async () => {
    const renamed = ["P", "Q", "R", "S", "T"].map((name) =>
      record(
        "list",
        "changed",
        [{ field: "name", oldValue: name, newValue: `${name}2` }],
        `${name}2`,
      ),
    );
    const leaving = record(
      "person",
      "changed",
      [{ field: "endDate", oldValue: null, newValue: "2030-01-31" }],
      "Fictional Leaver",
    );
    serverAnswers({
      "GET /api/session": changesViewer,
      "GET /api/changes?search=2030-01-31": page([
        entry([...renamed, leaving]),
      ]),
    });
    renderApp("/changes?search=2030-01-31");
    const [row] = (await rows()) as [HTMLElement];
    expect(within(row).getAllByRole("listitem")[0]?.textContent).toBe(
      "Changed Fictional Leaver: End set to Jan 31, 2030",
    );
  });

  it("say so when older ones cannot be loaded", async () => {
    serverAnswers({
      "GET /api/session": changesViewer,
      "GET /api/changes": page([], older),
      [`GET /api/changes?before=${older}`]: () =>
        Response.json({ error: "Internal Server Error" }, { status: 500 }),
    });
    renderApp("/changes");
    expect(
      await screen.findByText("None found in the changes read so far."),
    ).toBeDefined();
    await userEvent.click(
      await screen.findByRole("button", { name: "Show more" }),
    );
    expect((await screen.findByRole("alert")).textContent).toBe(
      "Fathom could not load older changes. Try again in a moment.",
    );
  });

  it("show a loading indicator until they arrive", async () => {
    serverAnswers({
      "GET /api/session": changesViewer,
      "GET /api/changes": () => new Promise<Response>(() => undefined),
    });
    renderApp("/changes");
    expect(await screen.findByLabelText("Loading")).toBeDefined();
  });

  it("say so when they cannot be loaded, and try again on request", async () => {
    let answer = () =>
      Response.json({ error: "Internal Server Error" }, { status: 500 });
    serverAnswers({
      "GET /api/session": changesViewer,
      "GET /api/changes": () => answer(),
    });
    renderApp("/changes");
    expect((await screen.findByRole("alert")).textContent).toMatch(
      /could not load the change history/,
    );
    answer = page([]);
    await userEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(
      await screen.findByText("No changes to data you can see yet."),
    ).toBeDefined();
  });
});
