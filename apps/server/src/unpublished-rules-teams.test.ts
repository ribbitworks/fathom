// SPDX-License-Identifier: Apache-2.0

// Integration tests for publishing private changes to feature teams: each is checked by the rules a
// fresh change goes through, against the data as it is now, and refused with the reason a fresh
// change gets, naming the team.

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { errorOf, unique } from "./test-app.ts";
import {
  change,
  changed,
  closeFeatureTeamTests,
  editor,
  liveTeam,
  send,
  startFeatureTeamTests,
  test,
} from "./test-feature-teams.ts";

beforeAll(startFeatureTeamTests);

afterAll(closeFeatureTeamTests);

describe("publishing a private change to a feature team", () => {
  it("is refused for a name another team has taken since", async () => {
    // Given the editor's private rename of one team, and another editor's rename of another team
    // to the same name, published since
    const name = unique("Fictional Taken");
    const [mine, theirs] = [await liveTeam(), await liveTeam()];
    const renamed = await change(mine, { name }, editor, { publish: false });
    expect(renamed.statusCode, renamed.body).toBe(200);
    const other = await test.signedIn("workforce-administrator");
    await changed(theirs, { name }, other);

    const response = await send(editor, "POST", "/api/unpublished/publish");

    expect(response.statusCode, response.body).toBe(409);
    expect(errorOf(response)).toBe(
      `The feature team ${name}: Another feature team has that name`,
    );
    await send(editor, "POST", "/api/unpublished/discard");
  });
});
