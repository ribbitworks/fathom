// SPDX-License-Identifier: Apache-2.0

// Tests that the Lists page offers deciding a list's and a choice's draft only to the roles that
// decide it: a list made with a Features column by Approve Features, and one made on Lists by
// Approve Configuration.

import { screen, waitFor, within } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { fictionalUser, renderApp, serverAnswers } from "./test-support.tsx";
import { added, noPeople, panel, row } from "./test-lists-page.tsx";

afterEach(() => {
  vi.unstubAllGlobals();
});

const roleWith = (permissions: string[]) => () =>
  Response.json({
    ...fictionalUser,
    permissions: [...permissions, "configuration:view", "people:view"],
  });

const featuresApprover = roleWith(["features:approve", "features:view"]);
const configurationApprover = roleWith(["configuration:approve"]);

// The list added, and its choice, made with a Features column, or on Lists.
const listMade = (madeWith: "features" | undefined) => {
  const made = madeWith === undefined ? {} : { madeWith };
  return {
    ...added,
    draft: { ...added.draft, ...made },
    choices: added.choices.map((one) => ({
      ...one,
      draft: { ...one.draft, ...made },
    })),
  };
};

async function openTeams(
  session: () => Response,
  madeWith: "features" | undefined,
) {
  serverAnswers({
    "GET /api/session": session,
    "GET /api/people": noPeople,
    "GET /api/lists": () => Response.json({ lists: [listMade(madeWith)] }),
  });
  renderApp("/lists/l5");
  await screen.findByRole("heading", { name: "Teams", level: 2 });
  await waitFor(() => {
    expect(panel().contains(document.activeElement)).toBe(true);
  });
}

// Whether a menu, once open, offers Approve…; a menu not shown offers nothing.
async function offersApprove(button: HTMLElement | null): Promise<boolean> {
  if (button === null) return false;
  await userEvent.click(button);
  const menu = await screen.findByRole("menu");
  const offered =
    within(menu).queryByRole("menuitem", { name: "Approve…" }) !== null;
  await userEvent.keyboard("{Escape}");
  await waitFor(() => {
    expect(screen.queryByRole("menu")).toBeNull();
  });
  return offered;
}

describe("deciding drafts on the Lists page", () => {
  it.each([
    ["made with a Features column", "features", featuresApprover, true],
    ["made with a Features column", "features", configurationApprover, false],
    ["made on Lists", undefined, featuresApprover, false],
    ["made on Lists", undefined, configurationApprover, true],
  ] as const)(
    "offers deciding a list %s, and its choice, as the role decides it",
    async (_case, madeWith, session, offered) => {
      await openTeams(session, madeWith);

      expect(
        await offersApprove(
          screen.getByRole("button", { name: "Drafts of Teams" }),
        ),
      ).toBe(offered);
      expect(
        await offersApprove(
          within(row("c8")).queryByRole("button", {
            name: "Actions for Platform",
          }),
        ),
      ).toBe(offered);
    },
  );
});
