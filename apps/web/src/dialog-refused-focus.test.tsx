// SPDX-License-Identifier: Apache-2.0

// Tests for where focus goes when a dialog refuses Save: into the field the reason is under, in
// every dialog that refuses before saving, and where the server refuses a name as taken.

import { screen, waitFor } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { MantineProvider } from "@mantine/core";
import { Notifications } from "@mantine/notifications";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "./api.ts";
import { ColumnDialog } from "./column-dialog.tsx";
import { DecisionModal } from "./decision-dialog.tsx";
import { noDrafts } from "./drafts.ts";
import { ListDialog } from "./list-dialog.tsx";
import {
  CycleLengthDialog,
  PatternDialog,
  ReleaseDialog,
  StreamDialog,
} from "./release-dialogs.tsx";
import { EndsDialog } from "./schedule-end-dialog.tsx";
import { box, show, stream } from "./test-release-dialogs.tsx";
import { fictionalPattern, serverAnswers } from "./test-support.tsx";
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

const taken = () =>
  Response.json(
    { error: "There is already a list with that name" },
    { status: 409 },
  );

const dialogProps = {
  onCancel: () => undefined,
  onBusy: () => undefined,
};

describe("a refused Save puts focus in the field refused", () => {
  it("names a view", async () => {
    show(() => (
      <ViewDialog
        views={[]}
        save={() => Promise.reject(new Error("not sent"))}
        onSaved={() => undefined}
        {...dialogProps}
      />
    ));
    await press("Save view");
    await expectFocusIn(box("Name"));
  });

  it("names a view the server refuses as taken", async () => {
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
    await press("Save view");
    expect(
      await screen.findByText("Another view already has that name"),
    ).toBeDefined();
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
    listDialog();
    await press("Create list");
    await expectFocusIn(box("Name"));
  });

  it("names a list the server refuses as taken", async () => {
    serverAnswers({ "POST /api/lists": taken });
    listDialog();
    await userEvent.type(box("Name"), "Fictional list");
    await press("Create list");
    expect(
      await screen.findByText("Another list already has that name"),
    ).toBeDefined();
    await expectFocusIn(box("Name"));
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
    columnDialog();
    await userEvent.type(box("Name"), "Fictional column");
    await press("Add column");
    expect(await screen.findByText("List needed")).toBeDefined();
    await expectFocusIn(screen.getByRole("combobox", { name: "List" }));
  });

  it("names a column the server refuses as taken", async () => {
    serverAnswers({
      "POST /api/people/columns": () =>
        Response.json(
          { error: "There is already a column with that name" },
          { status: 409 },
        ),
    });
    columnDialog();
    await userEvent.type(box("Name"), "Fictional column");
    await userEvent.click(screen.getByRole("combobox", { name: "Type" }));
    await userEvent.click(await screen.findByRole("option", { name: "Note" }));
    await press("Add column");
    expect(
      await screen.findByText("Another column already has that name"),
    ).toBeDefined();
    await expectFocusIn(box("Name"));
  });

  it("names a schedule", async () => {
    show((handlers) => <StreamDialog streams={[stream]} {...handlers} />);
    await press("Add schedule");
    await expectFocusIn(box("Name"));
  });

  it("changes a schedule's cycles", async () => {
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
  });

  it("changes a cycle's length", async () => {
    const second = stream.cycles[1] as (typeof stream.cycles)[number];
    show((handlers) => (
      <CycleLengthDialog stream={stream} cycle={second} {...handlers} />
    ));
    await userEvent.clear(box("Length"));
    await press("Change length");
    await expectFocusIn(box("Length"));
  });

  it("makes a release with no schedule chosen", async () => {
    show((handlers) => (
      <ReleaseDialog
        streams={[stream, { ...stream, id: "fictional-minors" }]}
        {...handlers}
      />
    ));
    await userEvent.type(box("Name"), "Fictional Two");
    await press("Make release");
    await expectFocusIn(screen.getByRole("combobox", { name: "Schedule" }));
  });

  it("ends a schedule on a day half typed", async () => {
    show((handlers) => <EndsDialog stream={stream} {...handlers} />);
    await userEvent.type(box("Schedule ends"), "202612");
    await press("Save");
    await expectFocusIn(box("Schedule ends"));
  });

  it("rejects drafts with no reason", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <MantineProvider>
          <Notifications />
          <DecisionModal
            decision={{
              asking: "reject",
              selection: { ...noDrafts(), people: ["Fictional 1"] },
              named: ["Fictional 1"],
            }}
            opened
            onClose={() => undefined}
            onDone={() => undefined}
          />
        </MantineProvider>
      </QueryClientProvider>,
    );
    await press("Reject");
    await expectFocusIn(screen.getByRole("textbox", { name: "Reason" }));
  });
});
