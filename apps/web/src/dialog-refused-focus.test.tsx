// SPDX-License-Identifier: Apache-2.0

// Tests for where focus goes when a dialog refuses Save: into the field the reason is under, in the
// dialogs naming views, lists, columns, schedules and releases, and where the server refuses a name
// as taken. The schedule's end, the milestone, the account and the reject dialogs are tested with
// the rest of their own tests.

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api.ts";
import { ColumnDialog } from "./column-dialog.tsx";
import { ListDialog } from "./list-dialog.tsx";
import {
  CycleLengthDialog,
  PatternDialog,
  ReleaseDialog,
  StreamDialog,
} from "./release-dialogs.tsx";
import { bodiesOf, box, show, stream } from "./test-release-dialogs.tsx";
import { fictionalPattern } from "./test-releases.ts";
import { serverAnswers } from "./test-support.tsx";
import { ViewDialog } from "./view-dialog.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const press = async (name: string) => {
  await userEvent.click(screen.getByRole("button", { name }));
};

async function expectFocusIn(field: HTMLElement) {
  await waitFor(() => {
    expect(document.activeElement).toBe(field);
  });
}

const dialogProps = {
  onCancel: () => undefined,
  onBusy: () => undefined,
};

const takenAs = (error: string) => () =>
  Response.json({ error }, { status: 409 });

describe("a refused Save puts focus in the field refused", () => {
  it("names a view", async () => {
    const save = vi.fn(() => Promise.reject(new Error("not sent")));
    show(() => (
      <ViewDialog
        views={[]}
        save={save}
        onSaved={() => undefined}
        {...dialogProps}
      />
    ));
    await press("Save view");
    await expectFocusIn(box("Name"));
    expect(save).not.toHaveBeenCalled();
  });

  it("names a view the server refuses as taken", async () => {
    // Given a view's name the server answers is taken
    show(() => (
      <ViewDialog
        views={[]}
        save={() =>
          Promise.reject(new ApiError(409, "There is already a view"))
        }
        onSaved={() => undefined}
        {...dialogProps}
      />
    ));
    await userEvent.type(box("Name"), "Fictional view");

    // When it is saved
    await press("Save view");

    // Then the reason is under Name, which has the focus
    expect(await screen.findByText("Another view has that name")).toBeDefined();
    await expectFocusIn(box("Name"));
  });

  const listDialog = () =>
    show(() => (
      <ListDialog
        lists={[]}
        permissions={[]}
        onSaved={() => undefined}
        onRetire={() => undefined}
        onDelete={() => undefined}
        {...dialogProps}
      />
    ));

  it("names a list", async () => {
    const fetch = serverAnswers({});
    listDialog();
    await press("Create list");
    await expectFocusIn(box("Name"));
    expect(bodiesOf(fetch)).toEqual([]);
  });

  it("names a list the server refuses as taken, and sends it again once the name changes", async () => {
    // Given a list's name the server answers is taken
    const fetch = serverAnswers({
      "POST /api/lists": takenAs("There is already a list with that name"),
    });
    listDialog();
    await userEvent.type(box("Name"), "Fictional list");

    // When it is created
    await press("Create list");

    // Then the reason is under Name, which has the focus
    expect(await screen.findByText("Another list has that name")).toBeDefined();
    await expectFocusIn(box("Name"));

    // And once the name is changed, creating sends it
    await userEvent.type(box("Name"), " two");
    await press("Create list");
    await waitFor(() => {
      expect(bodiesOf(fetch)).toEqual([
        expect.objectContaining({ name: "Fictional list" }),
        expect.objectContaining({ name: "Fictional list two" }),
      ]);
    });
  });

  const columnDialog = () =>
    show(() => (
      <ColumnDialog
        table="people"
        fields={[]}
        lists={[]}
        permissions={[]}
        onSaved={() => undefined}
        {...dialogProps}
      />
    ));

  it("adds a choice column with no list", async () => {
    const fetch = serverAnswers({});
    columnDialog();
    await userEvent.type(box("Name"), "Fictional column");
    await press("Add column");
    expect(await screen.findByText("List needed")).toBeDefined();
    await expectFocusIn(screen.getByRole("combobox", { name: "List" }));
    expect(bodiesOf(fetch)).toEqual([]);
  });

  it("names a column the server refuses as taken", async () => {
    // Given a note column whose name the server answers is taken
    serverAnswers({
      "POST /api/people/columns": takenAs(
        "There is already a column with that name",
      ),
    });
    columnDialog();
    await userEvent.type(box("Name"), "Fictional column");
    await userEvent.click(screen.getByRole("combobox", { name: "Type" }));
    await userEvent.click(await screen.findByRole("option", { name: "Note" }));

    // When it is added
    await press("Add column");

    // Then the reason is under Name, which has the focus
    expect(
      await screen.findByText("Another column has that name"),
    ).toBeDefined();
    await expectFocusIn(box("Name"));
  });

  it("names a schedule", async () => {
    const fetch = serverAnswers({});
    show((handlers) => <StreamDialog streams={[stream]} {...handlers} />);
    await press("Add schedule");
    await expectFocusIn(box("Name"));
    expect(bodiesOf(fetch)).toEqual([]);
  });

  it("changes a schedule's cycles", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <PatternDialog
        stream={stream}
        pattern={fictionalPattern()}
        {...handlers}
      />
    ));
    await userEvent.clear(box("Names"));
    await press("Save");
    await expectFocusIn(box("Names"));
    expect(bodiesOf(fetch)).toEqual([]);
  });

  it("changes a cycle's length", async () => {
    const fetch = serverAnswers({});
    const second = stream.cycles[1] as (typeof stream.cycles)[number];
    show((handlers) => (
      <CycleLengthDialog stream={stream} cycle={second} {...handlers} />
    ));
    await userEvent.clear(box("Length"));
    await press("Change length");
    await expectFocusIn(box("Length"));
    expect(bodiesOf(fetch)).toEqual([]);
  });

  it("makes a release with no schedule chosen", async () => {
    const fetch = serverAnswers({});
    show((handlers) => (
      <ReleaseDialog
        streams={[stream, { ...stream, id: "fictional-minors" }]}
        {...handlers}
      />
    ));
    await userEvent.type(box("Name"), "Fictional Two");
    await press("Make release");
    await expectFocusIn(screen.getByRole("combobox", { name: "Schedule" }));
    expect(bodiesOf(fetch)).toEqual([]);
  });
});
