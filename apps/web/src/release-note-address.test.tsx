// SPDX-License-Identifier: Apache-2.0

// Tests for a release's note kept in the Releases page's address, with the server's responses
// simulated.

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  fictionalRelease,
  fictionalStream,
  streamsAnswer,
} from "./test-releases.ts";
import { renderApp, serverAnswers, signedIn } from "./test-support.tsx";

const release = fictionalRelease();

describe("a release's note in the address", () => {
  it("opens again with its release's details", async () => {
    serverAnswers({
      "GET /api/session": signedIn,
      "GET /api/release-streams": streamsAnswer(
        [fictionalStream({ releases: [release] })],
        { canEditReleases: true },
      ),
    });
    renderApp(`/releases?open=${release.id}&note=note.${release.id}`);
    expect(
      await screen.findByRole("region", { name: "Note for Fictional One" }),
    ).toBeDefined();
  });
});
