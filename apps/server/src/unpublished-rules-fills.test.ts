// SPDX-License-Identifier: Apache-2.0

// Integration tests for publishing a private fill: kept over someone else's removal of its planned
// hire, it is checked against the hire as it is live.

import { type PrivateConflicts } from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  closeFillTests,
  editor,
  existing,
  fill,
  hire,
  person,
  send,
  startFillTests,
  test,
} from "./test-fills.ts";

beforeAll(startFillTests);

afterAll(closeFillTests);

describe("publishing a private fill", () => {
  it("publishes when kept over someone else's removal of the hire, published since", async () => {
    // Given the editor's private fill of a hire, and another editor's removal of it, published
    const id = await hire();
    const filling = await fill(id, existing(await person()), editor, {
      publish: false,
    });
    expect(filling.statusCode, filling.body).toBe(200);
    const other = await test.signedIn("workforce-administrator");
    const removed = await send(other, "DELETE", `/api/planned-hires/${id}`);
    expect(removed.statusCode, removed.body).toBe(200);

    // When the editor keeps the fill over the removal
    const asked = await send(editor, "POST", "/api/unpublished/publish");
    expect(asked.statusCode, asked.body).toBe(409);
    const response = await send(editor, "POST", "/api/unpublished/publish", {
      resolutions: asked
        .json<PrivateConflicts>()
        .conflicts.map(({ recordType, recordId, field, token }) => ({
          recordType,
          recordId,
          ...(field === undefined ? {} : { field }),
          keep: "mine",
          token,
        })),
    });

    // Then it publishes
    expect(response.statusCode, response.body).toBe(200);
  });
});
