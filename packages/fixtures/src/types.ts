// SPDX-License-Identifier: Apache-2.0

// The shapes of a fictional organization's records.

import type { Tier } from "@fathom/shared";

export interface FictionalList {
  id: string;
  name: string;
  visibility: Tier;
  choices: { id: string; label: string }[];
}

// A column drawing on a list, which gives its values their visibility, or holding one note for each
// person, with a visibility of its own.
export type FictionalColumn =
  | {
      id: string;
      name: string;
      type: "choice";
      listId: string;
      visibility: null;
      multiple: boolean;
    }
  | {
      id: string;
      name: string;
      type: "note";
      listId: null;
      visibility: "general";
      multiple: false;
    };

export interface FictionalPerson {
  id: string;
  preferredName: string;
  employeeId: string;
  // A choice in the built-in Positions list.
  positionId: string;
  // As YYYY-MM-DD, or null when not set.
  startDate: string | null;
  endDate: string | null;
  // Marked as a manager, whom others can report to: everyone whose position is Manager.
  isManager: boolean;
  // The chosen choices of each column, by column.
  values: Record<string, string[]>;
  // Each note column's note, as Markdown, by column; a column with no note is left out.
  notes: Record<string, string>;
}

// Who a person reports to, from a date, as YYYY-MM-DD.
export interface FictionalLine {
  personId: string;
  managerId: string;
  fromDate: string;
}

export interface FictionalTeam {
  managerId: string;
  name: string;
  // A colour from the palette, as the theme names it, or null for none.
  colour: string | null;
}

// A feature team: its name, lead, if any, colour, if any, and every record of people joining and
// leaving it, each from a day.
export interface FictionalFeatureTeam {
  id: string;
  name: string;
  leadId: string | null;
  colour: string | null;
  memberships: { personId: string; member: boolean; fromDate: string }[];
  // Who led it before its lead, until the day its lead took over.
  formerLead?: { personId: string; until: string };
}

// A planned hire: named, if it has a name, and known by its requisition, or by a temporary ID the
// seed data gives it while it has none, in the first hiring state with its meaning, due on its
// target date, as YYYY-MM-DD, if it has one, filled by a person, when it is, and with choices in
// some of the columns it shares with people, by column. Its manager is a person or a planned hire
// marked as a manager.
export interface FictionalHire {
  id: string;
  name: string | null;
  requisition: string | null;
  positionId: string;
  meaning: "proposed" | "open";
  targetDate: string | null;
  managerId: string | null;
  isManager: boolean;
  filledBy: string | null;
  values: Record<string, string[]>;
}

export interface FictionalOrganization {
  // The day, as YYYY-MM-DD, its dates are worked out from, such as the day the seed data is added.
  referenceDate: string;
  lists: FictionalList[];
  // The choices the seed data adds to the built-in Positions list, which Fathom makes itself.
  positions: FictionalList["choices"];
  columns: FictionalColumn[];
  people: FictionalPerson[];
  // One current line for everyone but the person at the top and those no manager was employed for.
  reportingLines: FictionalLine[];
  // Names for about half the managers' teams; the rest have none.
  teams: FictionalTeam[];
  // Feature teams drawn from current people across managers' teams: some coloured, one with no
  // lead, someone on two teams, someone who has left a team, so its history holds a past member,
  // and over half of those working on them, joined over two years, with moves between teams, a
  // lead change and a join to come.
  featureTeams: FictionalFeatureTeam[];
  // People made like the rest but not added, for drafts that add them.
  newcomers: FictionalPerson[];
  // Planned hires in each state, with requisitions and temporary IDs, most under current managers,
  // one past its target date, and one filled by someone who has not started yet, and one by an
  // internal transfer.
  hires: FictionalHire[];
}
