// SPDX-License-Identifier: Apache-2.0

// Tests for lists with meanings, against a PostgreSQL server of their own: the hiring states'
// choices each carry a meaning, given when a choice is added and kept or changed when it is edited,
// other lists' choices carry none, and drafting, discarding, undoing, publishing, and approving never
// leave a meaning with no choice offered for it, nor Positions with none at all.

import { listItems, lists } from "@fathom/db";
import type { Choice, List } from "@fathom/shared";
import { and, asc, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type Method, startTestApp, type TestApp } from "./test-app.ts";

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

let names = 0;
const unique = (prefix: string) => {
  names += 1;
  return `${prefix} ${String(names)}`;
};

const send = (
  method: Method,
  url: string,
  body?: object,
  who = editor,
  options?: { publish?: boolean },
) => test.request(who.cookie, method, url, body, options);

const refusal = (response: Awaited<ReturnType<typeof send>>) =>
  response.json<{ error: string }>().error;

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
    expect(refusal(without)).toBe(
      "Choose what the choice means: Proposed or Open",
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
    expect(refusal(meant)).toBe("Only a built-in list's choices have meanings");
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

  it("refuses retiring, removing, or giving another meaning to the last choice offered for a meaning", async () => {
    const message = "Hiring states needs a choice that means Proposed.";
    const retired = await retire(proposed);
    expect(retired.statusCode).toBe(409);
    expect(refusal(retired)).toBe(message);
    const removed = await send("DELETE", choiceUrl(proposed));
    expect(removed.statusCode).toBe(409);
    expect(refusal(removed)).toBe(message);
    const remeant = await send("PUT", choiceUrl(proposed), {
      label: "Request to hire",
      meaning: "open",
    });
    expect(remeant.statusCode).toBe(409);
    expect(refusal(remeant)).toBe(message);
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
    expect(refusal(refused)).toBe(
      `Your change to the choice ${label} in Hiring states no longer fits the data as it is now; change or discard it, then publish again`,
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
    expect(refusal(discarded)).toBe(
      "Hiring states needs a choice that means Proposed.",
    );
    const alone = await approve({ choices: [proposed] });
    expect(alone.statusCode).toBe(409);
    expect(refusal(alone)).toBe(
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
    expect(refusal(undone)).toBe(
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
    expect(refusal(refused)).toBe(
      `Your change to the choice ${label} in Hiring states no longer fits the data as it is now; change or discard it, then publish again`,
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
      expect(refusal(retired)).toBe("Positions needs a choice.");
      const removed = await send("DELETE", url);
      expect(removed.statusCode).toBe(409);
      expect(refusal(removed)).toBe("Positions needs a choice.");
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
      expect(refusal(approval)).toBe(
        "This would leave Positions with no choices.",
      );
    } finally {
      await send("DELETE", `${url}/draft`);
      await setRetired([String(second), ...others], false);
    }
  });
});
