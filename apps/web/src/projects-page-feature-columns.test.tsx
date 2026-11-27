// SPDX-License-Identifier: Apache-2.0

// Tests for the columns added to Features: adding, editing and removing them, and their drafts.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  chooseIn,
  optionsIn,
  recordCell,
  recordDraft,
} from "./test-support.tsx";
import { operationsOf } from "./plan-record-operations.ts";
import {
  addingAnswer,
  changeSetId,
  saved,
  deleted,
  openPage,
  sent,
  sentTo,
  sidePanel,
  newButton,
  later,
  answers,
  featureEditor,
  open,
} from "./test-projects-page.tsx";

import {
  sizes,
  size,
  columnsOf,
  withColumns,
  columnEditor,
  lists,
  openWith,
  newColumn,
  editColumn,
} from "./test-feature-columns.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the Features page", () => {
  describe("added columns", () => {
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

    it("adds a column to Features, offering only General lists", async () => {
      const path = "POST /api/features/columns";
      const added = { ...size, id: "new", name: "Fictional New" };
      const { fetch, held } = await openWith(withColumns(), {
        [path]: () => {
          held.plan = withColumns({ featureColumns: columnsOf([size, added]) });
          return Response.json({ field: added, changeSetId }, { status: 201 });
        },
      });
      const dialog = await newColumn();
      await chooseIn(dialog, "Type", "Choice from a list");
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
          },
        ]);
      });
      expect(
        await screen.findByRole("button", { name: "Fictional New column" }),
      ).toBeDefined();
    });

    it("asks no visibility for a column that holds its own values", async () => {
      await openWith(withColumns());
      const dialog = await newColumn();
      await chooseIn(dialog, "Type", "Number");
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

    it.each([
      ["Approve Features", ["features:approve", "people:view"], true],
      ["Approve Features without View People", ["features:approve"], false],
      [
        "Approve Configuration alone",
        ["configuration:approve", "people:view"],
        false,
      ],
    ] as const)(
      "offers deciding a column's draft to a role with %s: %s",
      async (_case, approve, offered) => {
        const score = {
          ...size,
          id: "10000000-0000-4000-8000-0000000000c5",
          name: "Fictional Drafted Tier",
          draft: { ...recordDraft({ action: "created" }), live: {} },
        };
        await openWith(
          withColumns({ featureColumns: columnsOf([score]) }),
          {},
          ["plan:view", "features:view", "configuration:view", ...approve],
        );
        await userEvent.click(
          screen.getByRole("button", {
            name: (name) => name.startsWith("Fictional Drafted Tier column"),
          }),
        );
        const menu = await screen.findByRole("menu");
        expect(
          within(menu).queryByRole("menuitem", { name: "Approve…" }) !== null,
        ).toBe(offered);
      },
    );

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
        { [path]: addingAnswer(() => start) },
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
          {
            records: [
              {
                name: "Fictional Noted",
                notes: { [requiredNote.id]: "Because" },
              },
            ],
          },
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
        { [path]: addingAnswer(() => start) },
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
          { records: [{ notes: { [requiredNote.id]: "Because" } }] },
        ]);
      });
    });

    it("keeps writing when Add's question says so, adding nothing", async () => {
      const start = withColumns({ featureColumns: columnsOf([requiredNote]) });
      const path = "POST /api/features";
      const { fetch } = await openWith(
        start,
        { [path]: addingAnswer(() => start) },
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
