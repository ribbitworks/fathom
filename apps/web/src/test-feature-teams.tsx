// SPDX-License-Identifier: Apache-2.0

// Helpers for the tests of Capacity's Feature teams tab: its address, a simulated server with no
// planned hires unless a test gives some, a role that sees it, and the tab opened.

import { screen } from "@testing-library/react";
import {
  fictionalTeamMonths,
  fictionalUser,
  monthsUrl,
  renderApp,
  serverAnswers,
} from "./test-support.tsx";

// Capacity on its Feature teams tab, with the view the search names.
export const featureTeamsAt = (search = "") =>
  `/capacity?mode=feature-teams${search.replace("?", "&")}`;

// No planned hires on the org chart, unless a test answers with some.
const noHires = { people: [], drafted: [] };

export const answer = (answers: Parameters<typeof serverAnswers>[0]) =>
  serverAnswers({
    "GET /api/org-chart": () => Response.json(noHires),
    ...answers,
  });

// The tab needs people's Personal details, and grouping by manager Confidential data, so every role
// here sees them.
export const session = (permissions: string[]) => () =>
  Response.json({
    ...fictionalUser,
    permissions: [
      ...permissions,
      "people:view",
      "personal:view",
      "confidential:view",
    ],
  });

export const reader = session(["people:view", "feature-teams:view"]);

export function openPage(
  search = "",
  answers: {
    months?: () => Response;
    session?: () => Response;
  } = {},
) {
  answer({
    "GET /api/session": answers.session ?? reader,
    [monthsUrl]: answers.months ?? (() => Response.json(fictionalTeamMonths)),
  });
  renderApp(featureTeamsAt(search));
  return screen.findByRole("grid", { name: "Feature teams by month" });
}
