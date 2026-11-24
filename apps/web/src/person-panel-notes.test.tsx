// SPDX-License-Identifier: Apache-2.0

// Tests for a person's notes in their side panel: opening, writing and saving a note as a draft,
// and keeping or discarding it as the person shown changes.

import {
  act,
  fireEvent,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { bodyOf, renderApp } from "./test-support.tsx";
import {
  setUpEachTest,
  viewer,
  background,
  robin,
  sasha,
  uma,
  panel,
  row,
  editAnswers,
  typeInto,
  settled,
  undone,
  renaming,
  savedAs,
  change,
} from "./test-person-panel.tsx";

setUpEachTest();

describe("changing a person's details", () => {
  // A note opens in its own panel, to read and to change.
  const open = (label: string) =>
    screen.getByRole("button", { name: `Open ${label}` });

  describe("writing a note", () => {
    const sashasNote = "Background for Sasha Fictional";
    const plans = { ...background, id: "f9", name: "Plans" };

    it("opens it to be read by a role that can't change it, with focus on its title and back on its button", async () => {
      // Given Sasha's details, seen by a role that may not change people
      editAnswers({ "GET /api/session": viewer });
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      // When her note is opened
      await userEvent.click(open("Background"));
      // Then it reads, with nothing to save, and focus on its title
      expect(await panel(sashasNote)).toBeDefined();
      expect(screen.queryByRole("button", { name: "Save" })).toBeNull();
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("heading", { name: sashasNote }),
        );
      });
      // And closing it puts focus back on its button
      await userEvent.click(screen.getByRole("button", { name: "Close note" }));
      await waitFor(() => {
        expect(document.activeElement).toBe(open("Background"));
      });
    });

    it("opens it in a panel under the details, which stay", async () => {
      // Given Sasha's details
      editAnswers();
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      // When her note is opened
      await userEvent.click(open("Background"));
      // Then it opens under her details, named for her, with focus on its title, as it opens to be read
      expect(await panel(sashasNote)).toBeDefined();
      expect(
        screen.getByRole("region", { name: "Sasha Fictional" }),
      ).toBeDefined();
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("heading", { name: sashasNote }),
        );
      });
    });

    it("saves it, closing its panel and putting focus back on its button", async () => {
      // Given Sasha's note opened
      const fetch = editAnswers({ "PATCH /api/people/2": savedAs });
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(open("Background"));
      await panel(sashasNote);
      // When it is cleared and saved
      await userEvent.click(screen.getByRole("radio", { name: "Editor" }));
      await userEvent.click(screen.getByRole("button", { name: "Clear" }));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      // Then it is saved, its panel closes, and focus is on the note's button
      expect(bodyOf(fetch, "PATCH", "/api/people/2")).toEqual([
        { notes: { f1: null } },
      ]);
      await waitFor(() => {
        expect(screen.queryByRole("region", { name: sashasNote })).toBeNull();
      });
      await waitFor(() => {
        expect(document.activeElement).toBe(open("Background"));
      });
    });

    it("puts focus in the editor of an empty note", async () => {
      editAnswers();
      renderApp("/people?open=E1");
      await panel("Robin Fictional");
      await userEvent.click(open("Background"));
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("textbox", { name: "Note" }),
        );
      });
    });

    it("closes a note with no changes when someone else is shown", async () => {
      // Given Sasha's note opened to be read
      editAnswers();
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(open("Background"));
      await panel(sashasNote);
      // When Robin's details are asked for from the table
      await userEvent.click(
        screen.getByRole("button", { name: "Show details of Robin Fictional" }),
      );
      // Then Robin's details show, and Sasha's note has closed
      expect(await panel("Robin Fictional")).toBeDefined();
      expect(screen.queryByRole("region", { name: sashasNote })).toBeNull();
    });

    it("asks before discarding a changed note when someone else is shown", async () => {
      // Given Sasha's note changed
      const fetch = editAnswers({ "PATCH /api/people/2": savedAs });
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(open("Background"));
      await panel(sashasNote);
      await userEvent.click(screen.getByRole("radio", { name: "Markdown" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Markdown" }),
        " more",
      );
      const showRobin = screen.getByRole("button", {
        name: "Show details of Robin Fictional",
      });
      // When Robin's details are asked for, and writing is kept
      await userEvent.click(showRobin);
      const asked = await screen.findByRole("dialog", {
        name: "Discard changes to the note?",
      });
      await userEvent.click(
        within(asked).getByRole("button", { name: "Keep writing" }),
      );
      // Then Sasha's details and her note stay
      await waitFor(() => {
        expect(
          screen.queryByRole("dialog", {
            name: "Discard changes to the note?",
          }),
        ).toBeNull();
      });
      expect(
        screen.getByRole("region", { name: "Sasha Fictional" }),
      ).toBeDefined();
      expect(screen.getByRole("region", { name: sashasNote })).toBeDefined();
      // When Robin's are asked for again, and the note discarded
      await userEvent.click(showRobin);
      await userEvent.click(
        within(
          await screen.findByRole("dialog", {
            name: "Discard changes to the note?",
          }),
        ).getByRole("button", { name: "Discard" }),
      );
      // Then Robin's details show, the note has closed, and nothing was saved
      expect(await panel("Robin Fictional")).toBeDefined();
      await waitFor(() => {
        expect(screen.queryByRole("region", { name: sashasNote })).toBeNull();
      });
      expect(bodyOf(fetch, "PATCH", "/api/people/2")).toEqual([]);
    });

    it("closes, with no changes, once the address names an ID nobody has", async () => {
      // Given Robin's note open, with no changes
      editAnswers();
      const history = renderApp("/people?open=E1");
      await panel("Robin Fictional");
      await userEvent.click(open("Background"));
      await panel("Background for Robin Fictional");
      // When the address names an ID nobody has
      act(() => {
        history.push("/people?open=E9");
      });
      // Then the note closes
      await screen.findByText("Nobody in People has the ID E9.");
      expect(
        screen.queryByRole("region", {
          name: "Background for Robin Fictional",
        }),
      ).toBeNull();
    });

    it("saves nothing, and closes, when saved with no changes", async () => {
      // Given Robin's empty note open
      const fetch = editAnswers();
      renderApp("/people?open=E1");
      await panel("Robin Fictional");
      await userEvent.click(open("Background"));
      await panel("Background for Robin Fictional");
      // When it is saved as it is
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      // Then it closes, and nothing is sent
      await waitFor(() => {
        expect(
          screen.queryByRole("region", {
            name: "Background for Robin Fictional",
          }),
        ).toBeNull();
      });
      expect(bodyOf(fetch, "PATCH", "/api/people/1")).toEqual([]);
    });

    it("stays open when its person's ID changes", async () => {
      // Given Robin's note open, with no changes
      renaming();
      const history = renderApp("/people?open=E1");
      await panel("Robin Fictional");
      await userEvent.click(open("Background"));
      await panel("Background for Robin Fictional");
      // When Robin's ID is changed in the details
      await typeInto("ID", "E7{Enter}");
      await waitFor(() => {
        expect(history.location.search).toContain("open=E7");
      });
      // Then the note stays open
      expect(
        screen.getByRole("region", { name: "Background for Robin Fictional" }),
      ).toBeDefined();
    });

    it("keeps naming why it was refused while a value is changed in the details", async () => {
      // Given a required note refused, empty
      editAnswers({
        "GET /api/people": () =>
          Response.json({
            people: [robin, sasha, uma],
            fields: [{ ...background, required: true }],
            order: [],
          }),
      });
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(open("Background"));
      await userEvent.click(
        await screen.findByRole("radio", { name: "Editor" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Clear" }));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      await screen.findByText("Background needed");
      // When her team name's editor is opened
      await userEvent.click(change("Reporting team name"));
      await screen.findByRole("textbox", { name: "Reporting team name" });
      // Then the note still names why it was refused
      expect(screen.getByText("Background needed")).toBeDefined();
    });

    function twoNotes() {
      editAnswers({
        "GET /api/people": () =>
          Response.json({
            people: [robin, sasha, uma],
            fields: [background, plans],
            order: [],
          }),
      });
    }

    it("opens another note in place of one with no changes", async () => {
      // Given Sasha's note opened to be read
      twoNotes();
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(open("Background"));
      await panel(sashasNote);
      // When another of her notes is opened
      await userEvent.click(open("Plans"));
      // Then it takes the first's place
      expect(await panel("Plans for Sasha Fictional")).toBeDefined();
      expect(screen.queryByRole("region", { name: sashasNote })).toBeNull();
    });

    it("keeps a note being changed when another of the person's notes is asked for", async () => {
      // Given Sasha's note being changed
      twoNotes();
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(open("Background"));
      await panel(sashasNote);
      await userEvent.click(screen.getByRole("radio", { name: "Editor" }));
      await userEvent.click(screen.getByRole("button", { name: "Clear" }));
      // When another of her notes is asked for
      await userEvent.click(open("Plans"));
      // Then focus goes back to the note being changed, which stays, and the other does not open
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("heading", { name: sashasNote }),
        );
      });
      expect(
        screen.queryByRole("region", { name: "Plans for Sasha Fictional" }),
      ).toBeNull();
    });

    it("keeps it being written when it is refused", async () => {
      // Given a required note
      const fetch = editAnswers({
        "GET /api/people": () =>
          Response.json({
            people: [robin, sasha, uma],
            fields: [{ ...background, required: true }],
            order: [],
          }),
      });
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      // When it is cleared and saved
      await userEvent.click(open("Background"));
      await userEvent.click(
        await screen.findByRole("radio", { name: "Editor" }),
      );
      await userEvent.click(screen.getByRole("button", { name: "Clear" }));
      await userEvent.click(screen.getByRole("button", { name: "Save" }));
      // Then it stays open, naming why, and nothing is saved
      expect(await screen.findByText("Background needed")).toBeDefined();
      expect(screen.getByRole("region", { name: sashasNote })).toBeDefined();
      expect(bodyOf(fetch, "PATCH", "/api/people/2")).toEqual([]);
    });

    it("leaves Cmd+Z in the note to the note's own undo, undoing no saved change", async () => {
      // Given a change saved from Sasha's details, and her note open in the editor
      const fetch = editAnswers({ "PATCH /api/people/2": savedAs });
      renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await typeInto("Reporting team name", "Harbour team{Enter}");
      await settled(fetch);
      await userEvent.click(open("Background"));
      await panel(sashasNote);
      await userEvent.click(screen.getByRole("radio", { name: "Editor" }));
      const editor = screen.getByRole("textbox", { name: "Note" });
      // When Cmd+Z is pressed in the note
      const leftToNote = fireEvent.keyDown(editor, { key: "z", metaKey: true });
      // Then the page leaves it to the note, and the change is undone only from outside it
      expect(leftToNote).toBe(true);
      act(() => {
        screen.getByRole("heading", { name: sashasNote }).focus();
      });
      await userEvent.keyboard("{Meta>}z{/Meta}");
      await waitFor(() => {
        expect(undone(fetch)).toBe(1);
      });
    });

    it("keeps a changed note while the address moves on its own, with focus on the details once it closes", async () => {
      // Given Sasha's note changed
      editAnswers();
      const history = renderApp("/people?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(open("Background"));
      await panel(sashasNote);
      await userEvent.click(screen.getByRole("radio", { name: "Markdown" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Markdown" }),
        " more",
      );
      // When the address moves to Robin, as by Back
      act(() => {
        history.push("/people?open=E1");
      });
      // Then Robin's details show, with Sasha's note still open
      expect(await panel("Robin Fictional")).toBeDefined();
      expect(screen.getByRole("region", { name: sashasNote })).toBeDefined();
      // When the note is closed
      await userEvent.click(screen.getByRole("button", { name: "Close note" }));
      // Then focus goes to Robin's name
      await waitFor(() => {
        expect(document.activeElement).toBe(
          screen.getByRole("heading", { name: "Robin Fictional" }),
        );
      });
    });

    it("asks before discarding a changed note when someone else is shown beside the org chart", async () => {
      // Given Sasha's note changed, beside the org chart
      editAnswers();
      renderApp("/org-chart?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(open("Background"));
      await panel(sashasNote);
      await userEvent.click(screen.getByRole("radio", { name: "Markdown" }));
      await userEvent.type(
        screen.getByRole("textbox", { name: "Markdown" }),
        " more",
      );
      // When her manager is chosen, and the note discarded
      await userEvent.click(
        within(row("Manager")).getByText("Robin Fictional"),
      );
      await userEvent.click(
        within(
          await screen.findByRole("dialog", {
            name: "Discard changes to the note?",
          }),
        ).getByRole("button", { name: "Discard" }),
      );
      // Then Robin's details show, and the note has closed
      expect(await panel("Robin Fictional")).toBeDefined();
      await waitFor(() => {
        expect(screen.queryByRole("region", { name: sashasNote })).toBeNull();
      });
    });

    it("opens under the details beside the org chart too", async () => {
      editAnswers();
      renderApp("/org-chart?open=E2");
      await panel("Sasha Fictional");
      await userEvent.click(open("Background"));
      expect(await panel(sashasNote)).toBeDefined();
      expect(
        screen.getByRole("region", { name: "Sasha Fictional" }),
      ).toBeDefined();
    });
  });
});
