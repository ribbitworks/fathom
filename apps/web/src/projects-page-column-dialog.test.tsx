// SPDX-License-Identifier: Apache-2.0

// Tests for the column dialog on Features and Activities: making a new list with a column, and asking
// before leaving the dialog with anything changed.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { listLengths, mostChoicesAtOnce } from "@fathom/shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { chooseIn } from "./test-support.tsx";
import { changeSetId, sent } from "./test-projects-page.tsx";
import {
  size,
  columnsOf,
  withColumns,
  openWith,
  columnEditor,
  newColumn,
  editColumn,
} from "./test-feature-columns.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("the column dialog on Features", () => {
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

    expect(within(dialog).getByText(/Name is too long/u)).toBeDefined();
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

  it("empties a choice being typed on Esc, keeping the dialog open, and asks on Esc after", async () => {
    await openWith(withColumns());
    const dialog = await newListDialog();
    await userEvent.type(choiceEntry(dialog), "Gold");

    await userEvent.keyboard("{Escape}");

    expect(choiceEntry(dialog)).toHaveProperty("value", "");
    expect(
      screen.queryByRole("dialog", { name: "Discard the new column?" }),
    ).toBeNull();
    await userEvent.keyboard("{Escape}");
    expect(
      await screen.findByRole("dialog", { name: "Discard the new column?" }),
    ).toBeDefined();
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
    expect(within(dialog).queryByText("Another list has that name")).toBeNull();
  });

  it("asks before Esc discards a new column with anything typed, and stays on Keep adding", async () => {
    await openWith(withColumns());
    const dialog = await newColumn();
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Tier",
    );

    await userEvent.keyboard("{Escape}");

    const question = await screen.findByRole("dialog", {
      name: "Discard the new column?",
    });
    await userEvent.click(
      within(question).getByRole("button", { name: "Keep adding" }),
    );
    expect(screen.getByRole("dialog", { name: "New column" })).toBeDefined();
    expect(
      within(screen.getByRole("dialog", { name: "New column" })).getByLabelText(
        "Name",
      ),
    ).toHaveProperty("value", "Fictional Tier");
  });

  it("closes only an open drop-down list on Esc, leaving the dialog open", async () => {
    await openWith(withColumns());
    const dialog = await newColumn();
    await userEvent.click(within(dialog).getByLabelText("List"));
    expect(
      await screen.findByRole("option", { name: "New list" }),
    ).toBeDefined();

    await userEvent.keyboard("{Escape}");

    // The list closing is what Esc shows, so waiting for it proves Esc was handled.
    await waitFor(() => {
      expect(screen.queryByRole("option", { name: "New list" })).toBeNull();
    });
    expect(screen.getByRole("dialog", { name: "New column" })).toBeDefined();
    expect(
      screen.queryByRole("dialog", { name: "Discard the new column?" }),
    ).toBeNull();
  });

  it("asks on a click outside the dialog with anything typed", async () => {
    await openWith(withColumns());
    const dialog = await newColumn();
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Tier",
    );

    const overlay = document.querySelector(".mantine-Modal-overlay");
    expect(overlay).not.toBeNull();
    await userEvent.click(overlay as Element);

    expect(
      await screen.findByRole("dialog", { name: "Discard the new column?" }),
    ).toBeDefined();
  });

  it("stays on the dialog when Esc closes the question, keeping what was typed", async () => {
    await openWith(withColumns());
    const dialog = await newColumn();
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Tier",
    );
    await userEvent.keyboard("{Escape}");
    await screen.findByRole("dialog", { name: "Discard the new column?" });

    await userEvent.keyboard("{Escape}");

    await waitFor(() => {
      expect(
        screen.queryByRole("dialog", { name: "Discard the new column?" }),
      ).toBeNull();
    });
    expect(
      within(screen.getByRole("dialog", { name: "New column" })).getByLabelText(
        "Name",
      ),
    ).toHaveProperty("value", "Fictional Tier");
  });

  it("opens again clean after Discard, closing without asking", async () => {
    await openWith(withColumns());
    const dialog = await newColumn();
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Tier",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    await userEvent.click(
      within(
        await screen.findByRole("dialog", { name: "Discard the new column?" }),
      ).getByRole("button", { name: "Discard" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "New column" })).toBeNull();
    });

    const again = await newColumn();
    expect(within(again).getByLabelText("Name")).toHaveProperty("value", "");
    await userEvent.click(
      within(again).getByRole("button", { name: "Cancel" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "New column" })).toBeNull();
    });
  });

  it("discards a new column with anything typed on Cancel, once Discard is chosen", async () => {
    await openWith(withColumns());
    const dialog = await newColumn();
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Tier",
    );

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );
    const question = await screen.findByRole("dialog", {
      name: "Discard the new column?",
    });
    await userEvent.click(
      within(question).getByRole("button", { name: "Discard" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "New column" })).toBeNull();
    });
  });

  it("closes a new column with nothing typed without asking", async () => {
    await openWith(withColumns());
    const dialog = await newColumn();

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    await waitFor(() => {
      expect(screen.queryByRole("dialog", { name: "New column" })).toBeNull();
    });
    expect(
      screen.queryByRole("dialog", { name: "Discard the new column?" }),
    ).toBeNull();
  });

  it("asks before closing a column's changes, and keeps editing on Keep editing", async () => {
    await openWith(withColumns());
    const dialog = await editColumn();
    await userEvent.type(within(dialog).getByLabelText("Name"), " Two");

    await userEvent.click(
      within(dialog).getByRole("button", { name: "Cancel" }),
    );

    const question = await screen.findByRole("dialog", {
      name: "Discard changes to the column?",
    });
    await userEvent.click(
      within(question).getByRole("button", { name: "Keep editing" }),
    );
    expect(screen.getByRole("dialog", { name: "Edit column" })).toBeDefined();
  });
});

describe("the column dialog on Activities", () => {
  it("adds a column with a new list, as Features does", async () => {
    // Given the New column dialog on Activities, with New list chosen
    const path = "POST /api/activities/columns";
    const added = { ...size, id: "new", name: "Fictional Tier" };
    const { fetch } = await openWith(
      withColumns(),
      {
        [path]: () =>
          Response.json({ field: added, changeSetId }, { status: 201 }),
      },
      columnEditor,
      "/activities",
    );
    const dialog = await newColumn();
    await userEvent.type(
      within(dialog).getByLabelText("Name"),
      "Fictional Tier",
    );
    await chooseIn(dialog, "List", "New list");

    // When the list is named and given a choice, and the column added
    await userEvent.type(
      within(dialog).getByLabelText("List name"),
      "Fictional Tiers",
    );
    await userEvent.type(
      within(dialog).getByRole("textbox", { name: "New choice name" }),
      "Gold{Enter}",
    );
    await userEvent.click(
      within(dialog).getByRole("button", { name: "Add column" }),
    );

    // Then the column is sent to Activities with its new list
    await waitFor(() => {
      expect(sent(fetch, path)).toEqual([
        expect.objectContaining({
          name: "Fictional Tier",
          type: "choice",
          newList: {
            name: "Fictional Tiers",
            choices: [{ label: "Gold", description: "" }],
          },
        }),
      ]);
    });
  });
});
