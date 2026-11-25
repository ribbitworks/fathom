// SPDX-License-Identifier: Apache-2.0

// Tests for lists with meanings, against a PostgreSQL server of their own: the meanings the
// hiring states' choices carry, and drafting, discarding, undoing, publishing and approving never
// leaving a meaning with no choice offered for it, nor Positions with none at all.

import { listItems, lists, people, plannedHires } from "@fathom/db";
import type { Choice, List } from "@fathom/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Person } from "@fathom/shared";
import {
  errorOf,
  generalReader,
  type Method,
  startTestApp,
  type TestApp,
  testPosition,
  unique,
} from "./test-app.ts";

let test: TestApp;
let editor: { id: string; cookie: string };
let approver: { id: string; cookie: string };
let states: { id: string };
let proposed: string;
let open: string;

beforeAll(async () => {
  test = await startTestApp();
  editor = await test.signedIn("workforce-administrator");
  approver = await test.signedIn("engineering-director");
  const [list] = await test.connection
    .select({ id: lists.id })
    .from(lists)
    .where(eq(lists.builtIn, "hiring-states"));
  states = list as { id: string };
  const choices = await test.connection
    .select({ id: listItems.id, meaning: listItems.meaning })
    .from(listItems)
    .where(eq(listItems.listId, states.id))
    .orderBy(asc(listItems.position));
  proposed = String(choices.find(({ meaning }) => meaning === "proposed")?.id);
  open = String(choices.find(({ meaning }) => meaning === "open")?.id);
});

afterAll(async () => {
  await test.close();
});

const send = (
  method: Method,
  url: string,
  body?: object,
  who = editor,
  options?: { publish?: boolean },
) => test.request(who.cookie, method, url, body, options);

async function readList(id: string): Promise<List> {
  const response = await send("GET", "/api/lists");
  return response
    .json<{ lists: List[] }>()
    .lists.find((list) => list.id === id) as List;
}

async function addStates(
  choices: { label: string; meaning?: string | null }[],
): Promise<{ choices: Choice[]; changeSetId: string }> {
  const response = await send("POST", `/api/lists/${states.id}/choices`, {
    choices,
  });
  expect(response.statusCode).toBe(201);
  return response.json<{ choices: Choice[]; changeSetId: string }>();
}

const choiceUrl = (id: string) => `/api/lists/${states.id}/choices/${id}`;

const retire = (id: string, retired = true) =>
  send("PUT", `${choiceUrl(id)}/retired`, { retired });

const approve = (body: object) =>
  send("POST", "/api/drafts/approval", body, approver);

const discard = (id: string) => send("DELETE", `${choiceUrl(id)}/draft`);

// Discards whatever drafts the tests left on the hiring states, so each starts from the list as
// Fathom builds it in.
async function discardAll(): Promise<void> {
  const list = await readList(states.id);
  for (const choice of [...list.choices].reverse()) {
    if (choice.draft !== undefined) await discard(choice.id);
  }
}

const liveMeaning = async (id: string) => {
  const [row] = await test.connection
    .select({ meaning: listItems.meaning, retired: listItems.retired })
    .from(listItems)
    .where(eq(listItems.id, id));
  return row;
};

describe("a list with meanings", () => {
  it("gives each hiring state its meaning, and other lists' choices none", async () => {
    const list = await readList(states.id);
    expect(list.choices.map(({ label, meaning }) => [label, meaning])).toEqual([
      ["Request to hire", "proposed"],
      ["Approved to hire", "open"],
      ["Hired", "hired"],
      ["Left", "left"],
    ]);
    const created = await send("POST", "/api/lists", {
      name: unique("Fictional Sites"),
    });
    const other = created.json<{ list: List }>().list;
    const added = await send("POST", `/api/lists/${other.id}/choices`, {
      choices: [{ label: "North" }],
    });
    expect(added.statusCode).toBe(201);
    const [north] = added.json<{ choices: Choice[] }>().choices;
    expect(north).not.toHaveProperty("meaning");
  });

  it("needs one of its meanings for each choice added, and refuses one in any other list", async () => {
    const without = await send("POST", `/api/lists/${states.id}/choices`, {
      choices: [{ label: unique("Fictional Interviewing") }],
    });
    expect(without.statusCode).toBe(400);
    expect(errorOf(without)).toBe(
      "Choose what the choice means: Proposed, Open, Hired, or Left",
    );
    const unknown = await send("POST", `/api/lists/${states.id}/choices`, {
      choices: [{ label: unique("Fictional Closed"), meaning: "closed" }],
    });
    expect(unknown.statusCode).toBe(400);
    const created = await send("POST", "/api/lists", {
      name: unique("Fictional Levels"),
    });
    const other = created.json<{ list: List }>().list;
    const meant = await send("POST", `/api/lists/${other.id}/choices`, {
      choices: [{ label: "Senior", meaning: "open" }],
    });
    expect(meant.statusCode).toBe(400);
    expect(errorOf(meant)).toBe("Only a built-in list's choices have meanings");
    const { choices } = await addStates([
      { label: unique("Fictional Interviewing"), meaning: "open" },
      { label: unique("Fictional Budgeted"), meaning: "proposed" },
    ]);
    expect(choices.map(({ meaning }) => meaning)).toEqual(["open", "proposed"]);
    await discardAll();
  });

  it("keeps a choice's meaning when an edit leaves it out, changes it when given, and approving saves it", async () => {
    const label = unique("Fictional Sourcing");
    const {
      choices: [added],
    } = await addStates([{ label, meaning: "open" }]);
    const id = String(added?.id);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
    const renamed = await send("PUT", choiceUrl(id), {
      label: `${label} Now`,
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json<{ choice: Choice }>().choice.meaning).toBe("open");
    const remeant = await send("PUT", choiceUrl(id), {
      label: `${label} Now`,
      meaning: "proposed",
    });
    expect(remeant.statusCode).toBe(200);
    const choice = remeant.json<{ choice: Choice }>().choice;
    expect(choice.meaning).toBe("proposed");
    expect(choice.draft?.changed).toEqual(["label", "meaning"]);
    expect(choice.draft?.live).toEqual({ label, meaning: "open" });
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
    expect(await liveMeaning(id)).toEqual({
      meaning: "proposed",
      retired: false,
    });
    const cleared = await send("PUT", choiceUrl(id), {
      label,
      meaning: null,
    });
    expect(cleared.statusCode).toBe(400);
    expect((await retire(id)).statusCode).toBe(200);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
  });

  it("refuses giving a state the meaning Hired while a planned hire is in it", async () => {
    const label = unique("Fictional Shortlisting");
    const {
      choices: [added],
    } = await addStates([{ label, meaning: "open" }]);
    const id = String(added?.id);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
    const position = String(
      (
        await test.connection
          .select({ id: listItems.id })
          .from(listItems)
          .innerJoin(lists, eq(lists.id, listItems.listId))
          .where(eq(lists.builtIn, "positions"))
          .limit(1)
      )[0]?.id,
    );
    const hire = await send("POST", "/api/planned-hires", {
      hires: [
        {
          positionId: position,
          stateId: id,
        },
      ],
    });
    expect(hire.statusCode).toBe(201);
    const hired = await send("PUT", choiceUrl(id), { label, meaning: "hired" });
    expect(hired.statusCode).toBe(409);
    expect(errorOf(hired)).toBe(
      "Planned hires are in this state, so it can't mean Hired. Move them to another state first.",
    );
    const [hireId = ""] = hire.json<{ ids: string[] }>().ids;
    await send("DELETE", `/api/planned-hires/${hireId}`);
    const remeant = await send("PUT", choiceUrl(id), {
      label,
      meaning: "hired",
    });
    expect(remeant.statusCode).toBe(200);
    // A hire put in the state meanwhile, as it still means Open live, keeps the change from being
    // approved, until someone fills it.
    const later = await send("POST", "/api/planned-hires", {
      hires: [{ positionId: position, stateId: id }],
    });
    const [laterId = ""] = later.json<{ ids: string[] }>().ids;
    expect((await approve({ plannedHires: [laterId] })).statusCode).toBe(200);
    const blocked = await approve({ choices: [id] });
    expect(blocked.statusCode).toBe(409);
    const [filler] = await test.connection
      .insert(people)
      .values({
        preferredName: unique("Fictional Filler"),
        employeeId: unique("FILL"),
        positionId: position,
      })
      .returning({ id: people.id });
    await test.connection
      .update(plannedHires)
      .set({ filledBy: String(filler?.id) })
      .where(eq(plannedHires.id, laterId));
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
    await test.connection
      .update(listItems)
      .set({ meaning: "open" })
      .where(eq(listItems.id, id));
    await test.connection
      .delete(plannedHires)
      .where(eq(plannedHires.id, laterId));
    await test.connection
      .delete(people)
      .where(eq(people.id, String(filler?.id)));
    expect((await retire(id)).statusCode).toBe(200);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
  });

  it("refuses retiring, removing, or giving another meaning to the last choice offered for a meaning", async () => {
    const message = "Hiring states needs a choice that means Proposed.";
    const retired = await retire(proposed);
    expect(retired.statusCode).toBe(409);
    expect(errorOf(retired)).toBe(message);
    const removed = await send("DELETE", choiceUrl(proposed));
    expect(removed.statusCode).toBe(409);
    expect(errorOf(removed)).toBe(message);
    const remeant = await send("PUT", choiceUrl(proposed), {
      label: "Request to hire",
      meaning: "open",
    });
    expect(remeant.statusCode).toBe(409);
    expect(errorOf(remeant)).toBe(message);
    // Retiring a choice offered for a meaning that has others is allowed.
    const {
      choices: [another],
    } = await addStates([
      { label: unique("Fictional Approved"), meaning: "open" },
    ]);
    expect((await approve({ choices: [String(another?.id)] })).statusCode).toBe(
      200,
    );
    expect((await retire(open)).statusCode).toBe(200);
    await discardAll();
    expect((await retire(String(another?.id))).statusCode).toBe(200);
    expect((await approve({ choices: [String(another?.id)] })).statusCode).toBe(
      200,
    );
  });

  it("refuses publishing a discard once another editor's published retirement relies on the choice discarded", async () => {
    const other = await test.signedIn("workforce-administrator");
    const label = unique("Fictional Interviewing");
    const {
      choices: [added],
    } = await addStates([{ label, meaning: "open" }]);
    const id = String(added?.id);
    const unpublished = { publish: false };
    expect(
      (
        await send(
          "DELETE",
          `${choiceUrl(id)}/draft`,
          undefined,
          editor,
          unpublished,
        )
      ).statusCode,
    ).toBe(200);
    expect(
      (
        await send(
          "PUT",
          `${choiceUrl(open)}/retired`,
          { retired: true },
          other,
          unpublished,
        )
      ).statusCode,
    ).toBe(200);
    const publish = (who: typeof editor) =>
      send("POST", "/api/unpublished/publish", undefined, who, unpublished);
    expect((await publish(other)).statusCode).toBe(200);
    const refused = await publish(editor);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The change to the choice ${label} in Hiring states no longer fits the data; change or discard it, then publish again`,
    );
    await send(
      "POST",
      "/api/unpublished/discard",
      undefined,
      editor,
      unpublished,
    );
    expect(
      (await send("DELETE", `${choiceUrl(open)}/draft`, undefined, other))
        .statusCode,
    ).toBe(200);
    expect((await discard(id)).statusCode).toBe(200);
  });

  it("counts a choice drafted to be added, but approving refuses to leave a meaning without a live one", async () => {
    const {
      choices: [requested],
    } = await addStates([
      { label: unique("Fictional Requested"), meaning: "proposed" },
    ]);
    const id = String(requested?.id);
    expect((await retire(proposed)).statusCode).toBe(200);
    // The retirement relies on the choice drafted to be added, so that draft stays.
    const discarded = await discard(id);
    expect(discarded.statusCode).toBe(409);
    expect(errorOf(discarded)).toBe(
      "Hiring states needs a choice that means Proposed.",
    );
    const alone = await approve({ choices: [proposed] });
    expect(alone.statusCode).toBe(409);
    expect(errorOf(alone)).toBe(
      "This would leave Hiring states with no choice that means Proposed.",
    );
    expect(await liveMeaning(proposed)).toEqual({
      meaning: "proposed",
      retired: false,
    });
    expect((await approve({ choices: [proposed, id] })).statusCode).toBe(200);
    expect(await liveMeaning(proposed)).toEqual({
      meaning: "proposed",
      retired: true,
    });
    // Put back as Fathom builds it in.
    expect((await retire(proposed, false)).statusCode).toBe(200);
    expect((await approve({ choices: [proposed] })).statusCode).toBe(200);
    expect((await retire(id)).statusCode).toBe(200);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
  });

  it("refuses undoing the addition of a choice another draft relies on for a meaning", async () => {
    const label = unique("Fictional Pending");
    const { choices, changeSetId } = await addStates([
      { label, meaning: "open" },
    ]);
    expect((await retire(open)).statusCode).toBe(200);
    const undone = await send("POST", `/api/undo/${changeSetId}`);
    expect(undone.statusCode).toBe(409);
    expect(errorOf(undone)).toBe(
      "Hiring states needs a choice that means Open.",
    );
    await discard(open);
    expect((await send("POST", `/api/undo/${changeSetId}`)).statusCode).toBe(
      200,
    );
    const left = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .where(
        and(
          eq(listItems.listId, states.id),
          eq(listItems.id, String(choices[0]?.id)),
        ),
      );
    expect(left).toEqual([]);
  });

  it("refuses publishing a retirement once another editor's published one leaves no other choice for the meaning", async () => {
    const other = await test.signedIn("workforce-administrator");
    const label = unique("Fictional Accepted");
    const {
      choices: [accepted],
    } = await addStates([{ label, meaning: "open" }]);
    const id = String(accepted?.id);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
    const unpublished = { publish: false };
    const retireAs = (who: typeof editor, choiceId: string) =>
      send(
        "PUT",
        `${choiceUrl(choiceId)}/retired`,
        { retired: true },
        who,
        unpublished,
      );
    expect((await retireAs(editor, open)).statusCode).toBe(200);
    expect((await retireAs(other, id)).statusCode).toBe(200);
    const publish = (who: typeof editor) =>
      send("POST", "/api/unpublished/publish", undefined, who, unpublished);
    expect((await publish(editor)).statusCode).toBe(200);
    const refused = await publish(other);
    expect(refused.statusCode).toBe(409);
    expect(errorOf(refused)).toBe(
      `The change to the choice ${label} in Hiring states no longer fits the data; change or discard it, then publish again`,
    );
    await send(
      "POST",
      "/api/unpublished/discard",
      undefined,
      other,
      unpublished,
    );
    await discard(open);
    expect((await retire(id)).statusCode).toBe(200);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
  });

  it("refuses retiring or removing the last position offered", async () => {
    const [positions] = await test.connection
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.builtIn, "positions"));
    const listId = String(positions?.id);
    const offered = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .where(and(eq(listItems.listId, listId), eq(listItems.retired, false)));
    const [last, ...others] = offered.map(({ id }) => id);
    const setRetired = (ids: string[], retired: boolean) =>
      test.connection
        .update(listItems)
        .set({ retired })
        .where(inArray(listItems.id, ids));
    await setRetired(others, true);
    try {
      const url = `/api/lists/${listId}/choices/${String(last)}`;
      const retired = await send("PUT", `${url}/retired`, { retired: true });
      expect(retired.statusCode).toBe(409);
      expect(errorOf(retired)).toBe("Positions needs a choice.");
      const removed = await send("DELETE", url);
      expect(removed.statusCode).toBe(409);
      expect(errorOf(removed)).toBe("Positions needs a choice.");
    } finally {
      await setRetired(others, false);
    }
  });

  it("refuses approving the retirement of the last position offered", async () => {
    const [positions] = await test.connection
      .select({ id: lists.id })
      .from(lists)
      .where(eq(lists.builtIn, "positions"));
    const listId = String(positions?.id);
    const offered = await test.connection
      .select({ id: listItems.id })
      .from(listItems)
      .where(and(eq(listItems.listId, listId), eq(listItems.retired, false)));
    const [last, second, ...others] = offered.map(({ id }) => id);
    const setRetired = (ids: string[], retired: boolean) =>
      test.connection
        .update(listItems)
        .set({ retired })
        .where(inArray(listItems.id, ids));
    await setRetired(others, true);
    const url = `/api/lists/${listId}/choices/${String(last)}`;
    try {
      const retired = await send("PUT", `${url}/retired`, { retired: true });
      expect(retired.statusCode).toBe(200);
      await setRetired([String(second)], true);
      const approval = await approve({ choices: [last] });
      expect(approval.statusCode).toBe(409);
      expect(errorOf(approval)).toBe(
        "This would leave Positions with no choices.",
      );
    } finally {
      await send("DELETE", `${url}/draft`);
      await setRetired([String(second), ...others], false);
    }
  });
});

describe("people's states", () => {
  // The first state offered with each meaning a person can have.
  async function firstOf(meaning: "hired" | "left"): Promise<string> {
    const list = await readList(states.id);
    return String(
      list.choices.find(
        (choice) => choice.meaning === meaning && !choice.retired,
      )?.id,
    );
  }

  async function addPerson(details: object): Promise<string> {
    const response = await send("POST", "/api/people", {
      people: [
        {
          preferredName: unique("Fictional Person"),
          employeeId: unique("S"),
          positionId: testPosition,
          startDate: "2020-01-01",
          ...details,
        },
      ],
    });
    expect(response.statusCode, response.body).toBe(201);
    const [id = ""] = response.json<{ ids: string[] }>().ids;
    expect((await approve({ people: [id] })).statusCode).toBe(200);
    return id;
  }

  async function stateSeen(id: string): Promise<string | undefined> {
    const response = await send("GET", "/api/people", undefined, approver);
    return response
      .json<{ people: Person[] }>()
      .people.find((person) => person.id === id)?.stateId;
  }

  it("shows each person a state of the meaning their end date gives them, their own while it has it", async () => {
    const label = unique("Fictional Resigned");
    const {
      choices: [added],
    } = await addStates([{ label, meaning: "left" }]);
    const resigned = String(added?.id);
    expect((await approve({ choices: [resigned] })).statusCode).toBe(200);
    const current = await addPerson({});
    const leaver = await addPerson({ endDate: "2021-01-01" });
    const chosen = await addPerson({
      endDate: "2021-01-01",
      stateId: resigned,
    });
    expect(await stateSeen(current)).toBe(await firstOf("hired"));
    expect(await stateSeen(leaver)).toBe(await firstOf("left"));
    expect(await stateSeen(chosen)).toBe(resigned);
    // A state of the other meaning stands for the first of the meaning the end date gives.
    const back = await send("PATCH", `/api/people/${chosen}`, {
      endDate: null,
    });
    expect(back.statusCode, back.body).toBe(200);
    expect((await approve({ people: [chosen] })).statusCode).toBe(200);
    expect(await stateSeen(chosen)).toBe(await firstOf("hired"));
    const changed = await send("PATCH", `/api/people/${leaver}`, {
      stateId: resigned,
    });
    expect(changed.statusCode, changed.body).toBe(200);
    expect((await approve({ people: [leaver] })).statusCode).toBe(200);
    expect(await stateSeen(leaver)).toBe(resigned);
  });

  it("refuses a state of another meaning than the end date gives, or one for planned hires", async () => {
    const left = await firstOf("left");
    const hired = await firstOf("hired");
    const add = (details: object) =>
      send("POST", "/api/people", {
        people: [
          {
            preferredName: unique("Fictional Person"),
            employeeId: unique("S"),
            positionId: testPosition,
            ...details,
          },
        ],
      });
    const early = await add({ stateId: left });
    expect(early.statusCode).toBe(400);
    expect(errorOf(early)).toBe(
      "A Left state is for someone whose end date has passed",
    );
    const late = await add({ endDate: "2021-01-01", stateId: hired });
    expect(late.statusCode).toBe(400);
    expect(errorOf(late)).toBe(
      "This person has left, so choose a state meaning Left",
    );
    const hiring = await add({ stateId: open });
    expect(hiring.statusCode).toBe(400);
    expect(errorOf(hiring)).toBe("That state is for planned hires");
  });

  it("keeps planned hires out of Left, and refuses a state meaning Left while a hire is in it", async () => {
    const left = await firstOf("left");
    const refused = await send("POST", "/api/planned-hires", {
      hires: [{ positionId: testPosition, stateId: left }],
    });
    expect(refused.statusCode).toBe(400);
    const label = unique("Fictional Screening");
    const {
      choices: [added],
    } = await addStates([{ label, meaning: "open" }]);
    const id = String(added?.id);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
    const hire = await send("POST", "/api/planned-hires", {
      hires: [{ positionId: testPosition, stateId: id }],
    });
    expect(hire.statusCode).toBe(201);
    const leaving = await send("PUT", choiceUrl(id), {
      label,
      meaning: "left",
    });
    expect(leaving.statusCode).toBe(409);
    expect(errorOf(leaving)).toBe(
      "Planned hires are in this state, so it can't mean Left. Move them to another state first.",
    );
    await send("POST", "/api/unpublished/discard");
  });

  async function addLeftState(): Promise<string> {
    const {
      choices: [added],
    } = await addStates([
      { label: unique("Fictional Laid Off"), meaning: "left" },
    ]);
    const id = String(added?.id);
    expect((await approve({ choices: [id] })).statusCode).toBe(200);
    return id;
  }

  const seenBy = async (who: { cookie: string }, id: string) =>
    (
      await send("GET", "/api/people", undefined, {
        id: "",
        cookie: who.cookie,
      })
    )
      .json<{ people: Person[] }>()
      .people.find((person) => person.id === id);

  it("checks a state against the end date the editor sees, and shows each reader the state their dates give", async () => {
    const person = await addPerson({});
    const drafted = await send("PATCH", `/api/people/${person}`, {
      endDate: "2021-01-01",
    });
    expect(drafted.statusCode, drafted.body).toBe(200);
    const generalOnly = await test.signedIn(["people:view", "people:edit"]);
    const planner = await test.signedIn(generalReader);
    expect((await seenBy(planner, person))?.stateId).toBe(
      await firstOf("hired"),
    );
    expect((await seenBy(editor, person))?.stateId).toBe(await firstOf("left"));
    // Offered Hired from the live date, the editor's choice is not refused for the draft's date.
    const chosen = await send(
      "PATCH",
      `/api/people/${person}`,
      { stateId: await firstOf("hired") },
      generalOnly,
    );
    expect(chosen.statusCode, chosen.body).toBe(200);
    // Someone only drafted to be added has no live dates, so their drafted ones are used.
    const added = await send(
      "POST",
      "/api/people",
      {
        people: [
          {
            preferredName: unique("Fictional Person"),
            employeeId: unique("S"),
            positionId: testPosition,
          },
        ],
      },
      generalOnly,
    );
    const [newcomer = ""] = added.json<{ ids: string[] }>().ids;
    const newState = await send(
      "PATCH",
      `/api/people/${newcomer}`,
      { stateId: await firstOf("left") },
      generalOnly,
    );
    expect(newState.statusCode).toBe(400);
    await send("POST", "/api/unpublished/discard", undefined, generalOnly);
  });

  it("shows a draft's old state as the row showed it", async () => {
    const resigned = await addLeftState();
    const leaver = await addPerson({ endDate: "2021-01-01" });
    const changed = await send("PATCH", `/api/people/${leaver}`, {
      stateId: resigned,
    });
    expect(changed.statusCode, changed.body).toBe(200);
    const row = await seenBy(editor, leaver);
    expect(row?.stateId).toBe(resigned);
    expect(row?.draft?.changed).toContain("stateId");
    expect(row?.draft?.live.stateId).toBe(await firstOf("left"));
    await send("DELETE", `/api/people/${leaver}/draft`);
  });

  it("keeps a state people have, live or in a draft, from being removed, and keeps it on them once retired", async () => {
    const kept = await addLeftState();
    const leaver = await addPerson({ endDate: "2021-01-01", stateId: kept });
    const live = await send("DELETE", choiceUrl(kept));
    expect(live.statusCode).toBe(409);
    expect(errorOf(live)).toBe(
      "This choice cannot be removed while it is in use; retire it instead",
    );
    const drafting = await addLeftState();
    const other = await addPerson({ endDate: "2021-01-01" });
    expect(
      (await send("PATCH", `/api/people/${other}`, { stateId: drafting }))
        .statusCode,
    ).toBe(200);
    expect((await send("DELETE", choiceUrl(drafting))).statusCode).toBe(409);
    await send("DELETE", `/api/people/${other}/draft`);
    expect((await retire(kept)).statusCode).toBe(200);
    expect((await approve({ choices: [kept] })).statusCode).toBe(200);
    const again = await send("PATCH", `/api/people/${leaver}`, {
      stateId: kept,
    });
    expect(again.statusCode, again.body).toBe(200);
  });
});
