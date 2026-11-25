// SPDX-License-Identifier: Apache-2.0

// Tests for the columns added to Features: adding, editing and removing them, and their drafts.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { listLengths, mostChoicesAtOnce } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chooseIn,
  optionsIn,
  recordCell,
  recordDraft,
} from "./test-support.tsx";
import { operationsOf } from "./projects.ts";
import {
  changeSetId,
  type Plan,
  saved,
  deleted,
  openPage,
  sent,
  sentTo,
  sidePanel,
  newButton,
  later,
  featurePlan,
  answers,
  featureEditor,
  open,
} from "./test-projects-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Features page", () => {
  describe("added columns", () => {
    const sizes = {
      id: "10000000-0000-4000-8000-0000000000a1",
      keyNumber: 1,
      name: "Fictional Sizes",
      description: "",
      visibility: "general",
      retired: false,
      choices: [
        {
          id: "10000000-0000-4000-8000-0000000000b1",
          label: "Small",
          description: "",
          retired: false,
        },
      ],
    };
    const hidden = {
      ...sizes,
      id: "10000000-0000-4000-8000-0000000000a2",
      keyNumber: 1,
      name: "Fictional Hidden",
      visibility: "personal",
    };
    const size = {
      id: "10000000-0000-4000-8000-0000000000c1",
      keyNumber: 1,
      name: "Fictional Size",
      type: "choice" as const,
      listId: sizes.id,
      visibility: null,
      multiple: false,
      required: false,
      onPlannedHires: false,
    };
    const columnsOf = (fields: Plan["featureColumns"]["fields"] = [size]) =>
      ({
        fields,
        order: ["name", ...fields.map(({ id }) => id)],
        lists: [sizes],
      }) as Plan["featureColumns"];
    const withColumns = (more: Partial<Plan> = {}) =>
      featurePlan({ featureColumns: columnsOf(), ...more });
    const columnEditor = [
      "plan:view",
      "features:view",
      "features:edit",
      "configuration:view",
      "people:view",
    ];
    const lists = () => Response.json({ lists: [sizes, hidden] });
    const openWith = (
      start: Plan,
      more: object = {},
      permissions = columnEditor,
    ) =>
      openPage(
        "/features",
        start,
        { ...answers, "GET /api/lists": lists, ...more },
        permissions,
      );
    const newColumn = async () => {
      await waitFor(() => {
        expect(
          screen.getByRole<HTMLButtonElement>("button", { name: "New column" })
            .disabled,
        ).toBe(false);
      });
      await userEvent.click(screen.getByRole("button", { name: "New column" }));
      return screen.findByRole("dialog", { name: "New column" });
    };
    const editColumn = async () => {
      await userEvent.click(
        screen.getByRole("button", { name: "Fictional Size column" }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: "Edit column…" }),
      );
      return screen.findByRole("dialog", { name: "Edit column" });
    };

    it("shows a value in its column", async () => {
      await openWith(
        withColumns({
          features: [
            { ...later, values: { [size.id]: [String(sizes.choices[0]?.id)] } },
          ],
        }),
        {},
        featureEditor,
      );
      expect(screen.getByRole("grid").textContent).toContain("Small");
    });

    it("offers no new column to those who only see features", async () => {
      await openWith(withColumns(), {}, ["plan:view", "features:view"]);
      expect(screen.queryByRole("button", { name: "New column" })).toBeNull();
    });

    it("offers no new column to a feature editor who doesn't see people, whose sight lists take", async () => {
      await openWith(withColumns(), {}, featureEditor);
      expect(screen.queryByRole("button", { name: "New column" })).toBeNull();
    });

    it("offers no new column to a role that changes configuration but doesn't edit features", async () => {
      await openWith(withColumns(), {}, [
        "plan:view",
        "features:view",
        "configuration:view",
        "configuration:edit",
      ]);
      expect(screen.queryByRole("button", { name: "New column" })).toBeNull();
    });

    it("adds a column to Features, offering only General lists and no planned hires", async () => {
      const path = "POST /api/features/columns";
      const added = { ...size, id: "new", name: "Fictional New" };
      const { fetch, held } = await openWith(withColumns(), {
        [path]: () => {
          held.plan = withColumns({ featureColumns: columnsOf([size, added]) });
          return Response.json({ field: added, changeSetId }, { status: 201 });
        },
      });
      const dialog = await newColumn();
      expect(
        within(dialog).queryByLabelText("Offered on planned hires"),
      ).toBeNull();
      expect(await optionsIn(dialog, "List")).toEqual([
        "Fictional Sizes",
        "New list",
      ]);
      await userEvent.click(
        screen.getByRole("option", { name: "Fictional Sizes" }),
      );
      await userEvent.type(
        within(dialog).getByLabelText("Name"),
        "Fictional New",
      );
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Add column" }),
      );
      await waitFor(() => {
        expect(sent(fetch, path)).toEqual([
          {
            name: "Fictional New",
            type: "choice",
            listId: sizes.id,
            multiple: false,
            required: false,
            onPlannedHires: false,
          },
        ]);
      });
      expect(
        await screen.findByRole("button", { name: "Fictional New column" }),
      ).toBeDefined();
    });

    it("adds a column with a new list, its choices typed one at a time, and reads the lists again", async () => {
      // Given the New column dialog, with New list chosen
      const path = "POST /api/features/columns";
      const added = { ...size, id: "new", name: "Fictional Tier" };
      const { fetch, held } = await openWith(withColumns(), {
        [path]: () => {
          held.plan = withColumns({ featureColumns: columnsOf([size, added]) });
          return Response.json({ field: added, changeSetId }, { status: 201 });
        },
      });
      const dialog = await newColumn();
      await userEvent.type(
        within(dialog).getByLabelText("Name"),
        "Fictional Tier",
      );
      await chooseIn(dialog, "List", "New list");

      // When the list is named and given two choices, and the column added
      await userEvent.type(
        within(dialog).getByLabelText("List name"),
        "Fictional Tiers",
      );
      await userEvent.type(choiceEntry(dialog), "Gold{Enter}Silver{Enter}");
      const listReads = () =>
        fetch.mock.calls.filter(([url]) => url === "/api/lists").length;
      const readsBefore = listReads();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Add column" }),
      );

      // Then the column is sent with its new list, and the lists offered are read again
      await waitFor(() => {
        expect(sent(fetch, path)).toEqual([
          {
            name: "Fictional Tier",
            type: "choice",
            newList: {
              name: "Fictional Tiers",
              choices: [
                { label: "Gold", description: "" },
                { label: "Silver", description: "" },
              ],
            },
            multiple: false,
            required: false,
            onPlannedHires: false,
          },
        ]);
      });
      await waitFor(() => {
        expect(listReads()).toBeGreaterThan(readsBefore);
      });
    });

    // The empty row's name, where a new list's choices are typed or pasted.
    const choiceEntry = (dialog: HTMLElement) =>
      within(dialog).getByRole("textbox", { name: "New choice name" });

    // The New column dialog with New list chosen, for a column named Fictional Tier.
    const newListDialog = async () => {
      const dialog = await newColumn();
      await userEvent.type(
        within(dialog).getByLabelText("Name"),
        "Fictional Tier",
      );
      await chooseIn(dialog, "List", "New list");
      return dialog;
    };

    it("asks a new list for its name and its choices, sending nothing", async () => {
      const { fetch } = await openWith(withColumns());
      const dialog = await newListDialog();

      await userEvent.click(
        within(dialog).getByRole("button", { name: "Add column" }),
      );

      expect(within(dialog).getByText("Name needed")).toBeDefined();
      expect(within(dialog).getByText("Choices needed")).toBeDefined();
      expect(sent(fetch, "POST /api/features/columns")).toEqual([]);
    });

    it("asks a new list for a name no other list has", async () => {
      await openWith(withColumns());
      const dialog = await newListDialog();

      await userEvent.type(
        within(dialog).getByLabelText("List name"),
        "fictional sizes",
      );

      expect(
        within(dialog).getByText("Another list has that name"),
      ).toBeDefined();
    });

    it("says so under the choice typed twice, keeping it once", async () => {
      await openWith(withColumns());
      const dialog = await newListDialog();

      await userEvent.type(choiceEntry(dialog), "Gold{Enter}Gold{Enter}");

      expect(within(dialog).getByText("Already in this list")).toBeDefined();
      expect(within(dialog).getAllByText("Gold")).toHaveLength(1);
    });

    it("refuses pasting more choices than a list takes at once, keeping those it has", async () => {
      await openWith(withColumns());
      const dialog = await newListDialog();
      await userEvent.click(choiceEntry(dialog));

      await userEvent.paste(
        Array.from(
          { length: mostChoicesAtOnce + 1 },
          (_, at) => `Choice ${String(at)}`,
        ).join("\n"),
      );

      expect(
        within(dialog).getByText(
          `Up to ${String(mostChoicesAtOnce)} lines at once`,
        ),
      ).toBeDefined();
      expect(within(dialog).queryByText("Choice 0")).toBeNull();
    });

    it("takes pasted choices one to a line, each description after a tab, as a list's panel does", async () => {
      await openWith(withColumns());
      const dialog = await newListDialog();
      await userEvent.click(choiceEntry(dialog));

      await userEvent.paste("Gold\tThe best\nSilver");

      expect(within(dialog).getByText("Gold")).toBeDefined();
      expect(within(dialog).getByText("The best")).toBeDefined();
      expect(within(dialog).getByText("Silver")).toBeDefined();
    });

    it("refuses a pasted choice longer than a choice may be", async () => {
      await openWith(withColumns());
      const dialog = await newListDialog();
      await userEvent.click(choiceEntry(dialog));

      await userEvent.paste(`Gold\n${"x".repeat(listLengths.choice + 1)}`);

      expect(within(dialog).getByText(/Too long/u)).toBeDefined();
      expect(within(dialog).queryByText("Gold")).toBeNull();
    });

    it("moves between the choices' rows by keys, as a list's panel does, from the empty row too", async () => {
      await openWith(withColumns());
      const dialog = await newListDialog();
      await userEvent.type(
        choiceEntry(dialog),
        "Gold{Enter}Silver{Enter}Bronze{Enter}",
      );
      const row = (label: string) =>
        within(dialog).getByText(label).closest('[role="row"]');

      // Up from the empty row goes to the last choice, and Home and End to the first and last
      await userEvent.keyboard("{ArrowUp}");
      await waitFor(() => {
        expect(document.activeElement).toBe(row("Bronze"));
      });
      await userEvent.keyboard("{Home}");
      await waitFor(() => {
        expect(document.activeElement).toBe(row("Gold"));
      });
      await userEvent.keyboard("{ArrowDown}");
      await waitFor(() => {
        expect(document.activeElement).toBe(row("Silver"));
      });
      await userEvent.keyboard("{End}");
      await waitFor(() => {
        expect(document.activeElement).toBe(row("Bronze"));
      });

      // A key held with Ctrl does nothing; Down past the last choice goes to the empty row
      await userEvent.keyboard("{Control>}{Backspace}{/Control}");
      expect(row("Bronze")).not.toBeNull();
      await userEvent.keyboard("{ArrowDown}");
      await waitFor(() => {
        expect(document.activeElement).toBe(choiceEntry(dialog));
      });
    });

    it("empties a choice being typed on Esc, keeping the dialog open, and closes it on Esc after", async () => {
      await openWith(withColumns());
      const dialog = await newListDialog();
      await userEvent.type(choiceEntry(dialog), "Gold");

      await userEvent.keyboard("{Escape}");

      expect(choiceEntry(dialog)).toHaveProperty("value", "");
      expect(screen.getByRole("dialog", { name: "New column" })).toBeDefined();
      await userEvent.keyboard("{Escape}");
      await waitFor(() => {
        expect(screen.queryByRole("dialog", { name: "New column" })).toBeNull();
      });
    });

    it("takes out a choice from its row's menu, which a click on its title closes", async () => {
      await openWith(withColumns());
      const dialog = await newListDialog();
      await userEvent.type(choiceEntry(dialog), "Gold{Enter}Silver{Enter}");
      const menuOf = (label: string) =>
        within(dialog).getByRole("button", { name: `Actions for ${label}` });

      await userEvent.click(menuOf("Silver"));
      await userEvent.click(
        within(await screen.findByRole("menu")).getByText("Silver"),
      );
      await waitFor(() => {
        expect(screen.queryByRole("menuitem", { name: /Remove/u })).toBeNull();
      });
      await userEvent.click(menuOf("Gold"));
      await userEvent.click(
        await screen.findByRole("menuitem", { name: /Remove/u }),
      );

      expect(within(dialog).queryByText("Gold")).toBeNull();
      expect(within(dialog).getByText("Silver")).toBeDefined();

      // And Delete on the ⋯ itself, not its row, takes nothing out
      menuOf("Silver").focus();
      await userEvent.keyboard("{Delete}");
      expect(within(dialog).getByText("Silver")).toBeDefined();
    });

    it("takes out the last choice with Backspace, putting focus in the empty row", async () => {
      await openWith(withColumns());
      const dialog = await newListDialog();
      await userEvent.type(choiceEntry(dialog), "Gold{Enter}Silver{Enter}");
      await userEvent.keyboard("{ArrowUp}");

      await userEvent.keyboard("{Backspace}");

      expect(within(dialog).queryByText("Silver")).toBeNull();
      await waitFor(() => {
        expect(document.activeElement).toBe(choiceEntry(dialog));
      });
    });

    it("takes out a choice with Delete on its row, putting focus on the next", async () => {
      await openWith(withColumns());
      const dialog = await newListDialog();
      await userEvent.type(choiceEntry(dialog), "Gold{Enter}Silver{Enter}");
      const gold = within(dialog).getByText("Gold").closest('[role="row"]');
      (gold as HTMLElement).focus();

      await userEvent.keyboard("{Delete}");

      expect(within(dialog).queryByText("Gold")).toBeNull();
      const silver = within(dialog).getByText("Silver").closest('[role="row"]');
      await waitFor(() => {
        expect(document.activeElement).toBe(silver);
      });
      expect(silver?.className).toMatch(/selectedRow/u);

      // And leaving the row leaves it unselected
      await userEvent.click(choiceEntry(dialog));
      expect(silver?.className).not.toMatch(/selectedRow/u);
    });

    it("names a list the server finds taken under List name, not as an alert", async () => {
      const path = "POST /api/features/columns";
      await openWith(withColumns(), {
        [path]: () =>
          Response.json(
            { error: "There is already a list with that name" },
            { status: 409 },
          ),
      });
      const dialog = await newColumn();
      await userEvent.type(
        within(dialog).getByLabelText("Name"),
        "Fictional Tier",
      );
      await chooseIn(dialog, "List", "New list");
      await userEvent.type(
        within(dialog).getByLabelText("List name"),
        "Fictional Tiers",
      );
      await userEvent.type(choiceEntry(dialog), "Gold{Enter}");
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Add column" }),
      );

      expect(
        await within(dialog).findByText("Another list has that name"),
      ).toBeDefined();
      expect(within(dialog).queryByRole("alert")).toBeNull();

      // And the refusal goes once the name changes
      await userEvent.type(within(dialog).getByLabelText("List name"), " Two");
      expect(
        within(dialog).queryByText("Another list has that name"),
      ).toBeNull();
    });

    it("asks no visibility for a column that holds its own values", async () => {
      await openWith(withColumns());
      const dialog = await newColumn();
      await chooseIn(dialog, "Type", "Number");
      expect(within(dialog).queryByLabelText("List")).toBeNull();
      expect(within(dialog).queryByRole("radiogroup")).toBeNull();
      expect(within(dialog).queryByLabelText(/visible|see/i)).toBeNull();
    });

    it("moves any column from its menu, added or built in", async () => {
      await openWith(withColumns());
      const place = (label: string) =>
        screen
          .getAllByRole("button", { name: / column/ })
          .map((button) => button.getAttribute("aria-label") ?? "")
          .findIndex((name) => name.startsWith(`${label} column`));
      const sizeAt = place("Fictional Size");
      await userEvent.click(
        screen.getByRole("button", { name: "Fictional Size column" }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: /^Move left/ }),
      );
      await waitFor(() => {
        expect(place("Fictional Size")).toBe(sizeAt - 1);
        expect(screen.queryByRole("menu")).toBeNull();
      });
      const statusAt = place("Status");
      await userEvent.click(
        screen.getByRole("button", { name: /^Status column/ }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: /^Move right/ }),
      );
      await waitFor(() => {
        expect(place("Status")).toBe(statusAt + 1);
      });
    });

    it("deletes a column for those who may change features", async () => {
      const path = `DELETE /api/features/columns/${size.id}`;
      const { fetch, held } = await openWith(withColumns(), {
        [path]: () => {
          held.plan = withColumns({ featureColumns: columnsOf([]) });
          return deleted();
        },
      });
      const dialog = await editColumn();
      await userEvent.click(
        within(dialog).getByRole("button", { name: "Remove column" }),
      );
      await waitFor(() => {
        expect(
          screen.queryByRole("button", { name: "Fictional Size column" }),
        ).toBeNull();
      });
      expect(sentTo(fetch)).toContain(path);
    });

    it("discards a column's draft through Features' columns", async () => {
      const path = `DELETE /api/features/columns/${size.id}/draft`;
      const drafted = {
        ...size,
        draft: recordDraft({
          action: "changed",
          changed: ["name"],
          live: { name: "Before" },
        }),
      };
      const { fetch } = await openWith(
        withColumns({ featureColumns: columnsOf([drafted]) }),
        { [path]: deleted },
      );
      await userEvent.click(
        screen.getByRole("button", { name: /^Fictional Size column/ }),
      );
      await userEvent.click(
        await screen.findByRole("menuitem", { name: /Discard/ }),
      );
      await waitFor(() => {
        expect(sentTo(fetch)).toContain(path);
      });
    });

    it("opens a linked column's menu, offering its link, and takes the column out of the address", async () => {
      const user = userEvent.setup();
      const linked = { ...size, keyNumber: 7 };
      const { history } = await openPage(
        `/features?column=${size.id}`,
        withColumns({ featureColumns: columnsOf([linked]) }),
        { ...answers, "GET /api/lists": lists },
        columnEditor,
      );
      const menu = await screen.findByRole("menu");
      expect(menu.textContent).toContain("Fictional Size");
      await waitFor(() => {
        expect(history.location.search).not.toContain("column=");
      });
      await user.click(
        within(menu).getByRole("menuitem", { name: "Copy link" }),
      );
      expect(await navigator.clipboard.readText()).toBe(
        `${window.location.origin}/go/column/7`,
      );
    });

    it("doesn't open a linked column's menu again when the table is drawn again", async () => {
      // Given a linked column's menu, opened and closed
      const user = userEvent.setup();
      const { history } = await openPage(
        `/features?column=${size.id}`,
        withColumns({ featureColumns: columnsOf([size]) }),
        { ...answers, "GET /api/lists": lists },
        columnEditor,
      );
      await screen.findByRole("menu");
      await waitFor(() => {
        expect(history.location.search).not.toContain("column=");
      });
      await user.keyboard("{Escape}");

      // When the Board is shown, then the table again
      await user.click(screen.getByRole("radio", { name: "Board" }));
      await waitFor(() => {
        expect(history.location.search).toContain("mode=board");
      });
      await user.click(screen.getByRole("radio", { name: "Table" }));

      // Then the column's menu stays closed
      const header = await screen.findByRole("button", {
        name: /^Fictional Size column/,
      });
      expect(header.getAttribute("aria-expanded")).toBe("false");
    });

    it("shows a new feature with an empty optional number while it saves", async () => {
      const score = {
        ...size,
        id: "10000000-0000-4000-8000-0000000000c3",
        keyNumber: 1,
        name: "Fictional Points",
        type: "number" as const,
        listId: null,
        visibility: "general" as const,
      };
      const start = withColumns({
        features: [],
        featureColumns: columnsOf([score]),
      });
      const path = "POST /api/features";
      let answer: (response: Response) => void = () => undefined;
      await openWith(
        start,
        {
          [path]: () =>
            new Promise<Response>((resolve) => {
              answer = resolve;
            }),
        },
        featureEditor,
      );
      await userEvent.click(await newButton("feature"));
      await userEvent.type(
        await screen.findByRole("textbox", { name: /^Name/ }),
        "Fictional Pending",
      );
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      expect(await screen.findByText("Fictional Pending")).toBeDefined();
      expect(screen.getByRole("grid").textContent).not.toContain("null");
      answer(Response.json({ plan: start, changeSetId }));
    });

    it("says so when the lists to offer could not be loaded, and tries again", async () => {
      let available = false;
      await openPage(
        "/features",
        withColumns(),
        {
          ...answers,
          "GET /api/lists": () =>
            available ? lists() : new Response(null, { status: 500 }),
        },
        columnEditor,
      ).catch(() => undefined);
      const again = await screen.findByRole("button", { name: /Try again/ });
      available = true;
      await userEvent.click(again);
      expect(await screen.findByRole("grid")).toBeDefined();
    });

    it("saves a value typed in an added column's cell", async () => {
      const score = {
        ...size,
        id: "10000000-0000-4000-8000-0000000000c2",
        keyNumber: 1,
        name: "Fictional Score",
        type: "number" as const,
        listId: null,
        visibility: "general" as const,
      };
      const start = withColumns({
        features: [later],
        featureColumns: columnsOf([score]),
      });
      const path = `PUT /api/features/${later.id}`;
      const { fetch } = await openWith(
        start,
        { [path]: saved(() => start) },
        featureEditor,
      );
      await userEvent.dblClick(recordCell(later.id, score.id) as HTMLElement);
      await userEvent.keyboard("7{Enter}");
      await waitFor(() => {
        expect(sent(fetch, path)).toMatchObject([
          { numbers: { [score.id]: 7 } },
        ]);
      });
    });

    it("saves a value typed in a cell of a column only drafted to be added", async () => {
      const score = {
        ...size,
        id: "10000000-0000-4000-8000-0000000000c3",
        keyNumber: 1,
        name: "Fictional Drafted Score",
        type: "number" as const,
        listId: null,
        visibility: "general" as const,
        draft: { ...recordDraft({ action: "created" }), live: {} },
      };
      const start = withColumns({
        features: [later],
        featureColumns: columnsOf([score]),
      });
      const path = `PUT /api/features/${later.id}`;
      const { fetch } = await openWith(
        start,
        { [path]: saved(() => start) },
        featureEditor,
      );
      await userEvent.dblClick(recordCell(later.id, score.id) as HTMLElement);
      await userEvent.keyboard("7{Enter}");
      await waitFor(() => {
        expect(sent(fetch, path)).toMatchObject([
          { numbers: { [score.id]: 7 } },
        ]);
      });
    });

    it("sends only the added column's value a change gives", async () => {
      const path = `PUT /api/features/${later.id}`;
      const { fetch } = await open(withColumns(), {
        [path]: saved(withColumns),
      });
      await operationsOf("feature").change(
        { ...later, values: { other: ["kept"] } },
        { values: { [size.id]: ["picked"] } },
      );
      expect(sent(fetch, path)).toMatchObject([
        { values: { [size.id]: ["picked"] }, links: {} },
      ]);
    });

    it("offers an added column in the new feature's form", async () => {
      await openWith(withColumns(), {}, featureEditor);
      await userEvent.click(await newButton("feature"));
      await screen.findByRole("heading", { name: "New feature" });
      const columns = within(sidePanel()).getByRole("region", {
        name: "Columns",
      });
      expect(within(columns).getByText("Fictional Size")).toBeTruthy();
    });

    const requiredNote = {
      ...size,
      id: "10000000-0000-4000-8000-0000000000c4",
      keyNumber: 1,
      name: "Fictional Why",
      type: "note" as const,
      listId: null,
      visibility: "general" as const,
      required: true,
    };
    const startWriting = async () => {
      await userEvent.click(await newButton("feature"));
      await userEvent.click(
        await screen.findByRole("button", { name: "Open Fictional Why" }),
      );
      const opened = await screen.findByRole("region", {
        name: "Fictional Why for New feature",
      });
      await userEvent.click(within(opened).getByText("Markdown"));
      await userEvent.type(
        within(opened).getByRole("textbox", { name: "Markdown" }),
        "Because",
      );
      return opened;
    };

    it("writes a new feature's note in the note's own panel, and sends it", async () => {
      const start = withColumns({ featureColumns: columnsOf([requiredNote]) });
      const path = "POST /api/features";
      const { fetch } = await openWith(
        start,
        { [path]: saved(() => start) },
        featureEditor,
      );
      const opened = await startWriting();
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name" }),
        "Fictional Noted",
      );
      await userEvent.click(
        within(opened).getByRole("button", { name: "Save" }),
      );
      await waitFor(() => {
        expect(
          screen.queryByRole("region", {
            name: "Fictional Why for New feature",
          }),
        ).toBeNull();
      });
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      await waitFor(() => {
        expect(sent(fetch, path)).toMatchObject([
          { name: "Fictional Noted", notes: { [requiredNote.id]: "Because" } },
        ]);
      });
    });

    it("names a required note left empty under its row", async () => {
      await openWith(
        withColumns({ featureColumns: columnsOf([requiredNote]) }),
        {},
        featureEditor,
      );
      await userEvent.click(await newButton("feature"));
      await userEvent.type(
        await screen.findByRole("textbox", { name: "Name" }),
        "Fictional Noted",
      );
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      expect(
        await within(sidePanel()).findByText("Fictional Why needed"),
      ).toBeTruthy();
      const change = screen.getByRole("button", {
        name: "Open Fictional Why",
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(change);
      });
    });

    it("asks before Add discards a note being written", async () => {
      const start = withColumns({ featureColumns: columnsOf([requiredNote]) });
      const path = "POST /api/features";
      const { fetch } = await openWith(
        start,
        { [path]: saved(() => start) },
        featureEditor,
      );
      const opened = await startWriting();
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name" }),
        "Fictional Noted",
      );
      await userEvent.click(
        within(opened).getByRole("button", { name: "Save" }),
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "Open Fictional Why" }),
      );
      const again = await screen.findByRole("region", {
        name: "Fictional Why for New feature",
      });
      await userEvent.click(within(again).getByText("Markdown"));
      await userEvent.type(
        within(again).getByRole("textbox", { name: "Markdown" }),
        " more",
      );
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      await screen.findByText("Discard changes to the note?");
      expect(sent(fetch, path)).toEqual([]);
      await userEvent.click(screen.getByRole("button", { name: "Discard" }));
      await waitFor(() => {
        expect(sent(fetch, path)).toMatchObject([
          { notes: { [requiredNote.id]: "Because" } },
        ]);
      });
    });

    it("keeps writing when Add's question says so, adding nothing", async () => {
      const start = withColumns({ featureColumns: columnsOf([requiredNote]) });
      const path = "POST /api/features";
      const { fetch } = await openWith(
        start,
        { [path]: saved(() => start) },
        featureEditor,
      );
      const opened = await startWriting();
      await userEvent.type(
        screen.getByRole("textbox", { name: "Name" }),
        "Fictional Noted",
      );
      await userEvent.click(
        within(opened).getByRole("button", { name: "Save" }),
      );
      await userEvent.click(
        await screen.findByRole("button", { name: "Open Fictional Why" }),
      );
      const again = await screen.findByRole("region", {
        name: "Fictional Why for New feature",
      });
      await userEvent.click(within(again).getByText("Markdown"));
      await userEvent.type(
        within(again).getByRole("textbox", { name: "Markdown" }),
        " more",
      );
      await userEvent.click(screen.getByRole("button", { name: "Add" }));
      await screen.findByText("Discard changes to the note?");
      await userEvent.click(
        screen.getByRole("button", { name: "Keep writing" }),
      );
      expect(sent(fetch, path)).toEqual([]);
      expect(
        screen.getByRole("region", { name: "Fictional Why for New feature" }),
      ).toBeTruthy();
    });

    it("asks before Cancel discards a note being written", async () => {
      await openWith(
        withColumns({ featureColumns: columnsOf([requiredNote]) }),
        {},
        featureEditor,
      );
      await startWriting();
      await userEvent.click(
        within(screen.getByRole("region", { name: "New feature" })).getByRole(
          "button",
          { name: "Cancel" },
        ),
      );
      await screen.findByText("Discard changes to the note?");
      await userEvent.click(screen.getByRole("button", { name: "Discard" }));
      await waitFor(() => {
        expect(
          screen.queryByRole("heading", { name: "New feature" }),
        ).toBeNull();
      });
    });
  });
});
