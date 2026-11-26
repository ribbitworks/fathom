// SPDX-License-Identifier: Apache-2.0

// Unit tests for a feature team's draft as a reader sees it, by role and data class: the fields and
// days it changes, who made it, and why it was rejected.

import { type ClassAccess } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import type { Draft } from "./draft-records.ts";
import type { Maker } from "./draft-makers.ts";
import {
  draftAsSeen,
  type TeamVersions,
  teamSight,
} from "./feature-team-sight.ts";
import {
  draftOf,
  everyone,
  hire,
  lead,
  leaver,
  member,
  starter,
  teamMember,
  teamMemberSeeingDays,
  today,
  workforceAdministrator,
} from "./test-feature-team-sight.ts";

describe("a team's draft as a reader sees it", () => {
  const live = {
    name: "Fictional Team",
    leadId: lead,
    members: [lead, member],
  };
  const sightOf = (access: ClassAccess) =>
    teamSight(access, everyone, { day: today, today });
  const versionsOf = (after: Record<string, unknown>): TeamVersions => ({
    before: live,
    teamToday: live,
    after,
    team: after,
  });
  const seenAs = (
    access: ClassAccess,
    fields: Record<string, unknown>,
    details: Partial<Draft> = {},
    maker?: Maker,
  ) =>
    draftAsSeen(
      sightOf(access),
      versionsOf({ ...live, ...fields }),
      draftOf(fields, details),
      maker,
    ).draft;

  it("is none for a team with no draft", () => {
    expect(
      draftAsSeen(
        sightOf(workforceAdministrator),
        versionsOf(live),
        undefined,
        undefined,
      ),
    ).toEqual({});
  });

  it("names the fields a draft changes, with their live values", () => {
    const seen = seenAs(teamMember, {
      name: "Fictional Renamed",
      leadId: member,
    });

    expect(seen).toMatchObject({
      action: "changed",
      changed: ["name", "leadId"],
      live: { name: "Fictional Team", leadId: lead },
      state: "waiting",
    });
  });

  it("has no live values for a team only drafted to be added", () => {
    // Given a draft adding a team
    const fields = {
      name: "Fictional New Team",
      leadId: null,
      members: [member],
    };

    // When a reader without Personal data sees it
    const seen = draftAsSeen(
      sightOf(teamMember),
      { before: undefined, teamToday: undefined, after: fields, team: fields },
      draftOf(fields, { action: "created" }),
      undefined,
    ).draft;

    // Then it changes its name and members, with nothing live
    expect(seen).toMatchObject({
      action: "created",
      changed: ["name", "members"],
      live: {},
    });
  });

  it("shows the live members but not a lead who has not started, to a role without Personal data", () => {
    // Given a team led by someone who has not started
    const before = { ...live, leadId: starter, members: [member, starter] };
    const after = { ...before, leadId: member };

    // When a draft makes the member lead
    const seen = draftAsSeen(
      sightOf(teamMember),
      { before, teamToday: before, after, team: after },
      draftOf({ leadId: member }),
      undefined,
    ).draft;

    // Then the live lead is shown as none
    expect(seen?.live).toEqual({ leadId: null });
  });

  it("shows the live members it sees when the draft changes them", () => {
    expect(
      seenAs(workforceAdministrator, { members: [lead, member, starter] })
        ?.live,
    ).toEqual({ members: [lead, member] });
  });

  describe("adding only someone who has not started", () => {
    const fields = { members: [lead, member, starter] };

    it("is no draft to a role without Personal data", () => {
      expect(seenAs(teamMember, fields)).toBeUndefined();
    });

    it("is a draft of the members to a role with Personal data", () => {
      expect(seenAs(workforceAdministrator, fields)?.changed).toEqual([
        "members",
      ]);
    });
  });

  describe("making someone who has not started the lead of a team with none", () => {
    const before = {
      name: "Fictional Team",
      leadId: null,
      members: [lead, member],
    };
    const fields = { leadId: starter, members: [lead, member, starter] };
    const leadDraftAs = (access: ClassAccess) =>
      draftAsSeen(
        sightOf(access),
        {
          before,
          teamToday: before,
          after: { ...before, ...fields },
          team: { ...before, ...fields },
        },
        draftOf(fields),
        undefined,
      ).draft;

    it("is no draft to a role without Personal data", () => {
      expect(leadDraftAs(teamMember)).toBeUndefined();
    });

    it("is a draft of the lead and members to a role with Personal data", () => {
      expect(leadDraftAs(workforceAdministrator)?.changed).toEqual([
        "leadId",
        "members",
      ]);
    });
  });

  it("keeps a rename but not the members who have not started, to a role without Personal data", () => {
    const seen = seenAs(teamMember, {
      name: "Fictional Renamed",
      members: [lead, member, starter],
    });

    expect(seen?.changed).toEqual(["name"]);
  });

  it("stays listed with no change, to a role with Personal data, when only someone who has left remains in it", () => {
    // Given a draft whose only change is someone who has since left
    const fields = { members: [lead, member, leaver] };

    // When readers see it
    const withPersonal = seenAs(workforceAdministrator, fields);
    const withoutPersonal = seenAs(teamMember, fields);

    // Then only those with Personal data are shown it, to clear it
    expect(withPersonal).toMatchObject({ changed: [], live: {} });
    expect(withoutPersonal).toBeUndefined();
  });

  describe("the days a draft gives", () => {
    const fields = {
      members: [lead, member, starter],
      memberFrom: { [starter]: "2026-08-01" },
      leadId: member,
      leadFrom: { [member]: "2026-09-01" },
    };

    it("are shown, with the lead's day apart, to a role that sees them", () => {
      const seen = seenAs(workforceAdministrator, fields);

      expect(seen).toMatchObject({
        days: { [starter]: "2026-08-01" },
        leadDay: "2026-09-01",
      });
      expect(seen?.changed).toEqual([
        "members",
        "memberFrom",
        "leadId",
        "leadFrom",
      ]);
    });

    it("are shown to a role without Personal data once they are General", () => {
      const seen = seenAs(teamMemberSeeingDays, {
        ...fields,
        memberFrom: { [member]: "2026-08-01" },
      });

      expect(seen).toMatchObject({ days: { [member]: "2026-08-01" } });
    });

    it("are not told to a role that doesn't see them, nor the fields that hold them", () => {
      const unseen = seenAs(teamMember, fields);

      expect(unseen).not.toHaveProperty("days");
      expect(unseen).not.toHaveProperty("leadDay");
      expect(unseen?.changed).toEqual(["leadId"]);
    });

    it("are shown for planned hires to a role that doesn't see people's, apart from people's", () => {
      const seen = seenAs(teamMember, {
        members: [lead, member, hire],
        memberFrom: { [starter]: "2026-08-01" },
        hireFrom: { [hire]: "2026-08-01" },
        leadId: hire,
        hireLeadFrom: { [hire]: "2026-09-01" },
      });

      expect(seen).toMatchObject({
        hireDays: { [hire]: "2026-08-01" },
        hireLeadDay: "2026-09-01",
      });
      expect(seen).not.toHaveProperty("days");
      expect(seen?.changed).toEqual([
        "members",
        "hireFrom",
        "leadId",
        "hireLeadFrom",
      ]);
    });

    it("leave out the day of someone the reader doesn't see", () => {
      // Given a role that sees the days, but not Personal data
      // When a draft gives a day only to someone who has not started
      const seen = seenAs(teamMemberSeeingDays, fields);

      // Then that day is not shown, nor the field that holds it
      expect(seen).not.toHaveProperty("days");
      expect(seen?.changed).toEqual(["leadId", "leadFrom"]);
    });
  });

  describe("why a draft was rejected", () => {
    const rejected = { state: "rejected" as const, reason: "Fictional reason" };

    it("is shown to a reader who sees all the draft", () => {
      expect(
        seenAs(teamMember, { name: "Fictional Renamed" }, rejected),
      ).toMatchObject({ state: "rejected", reason: "Fictional reason" });
    });

    it("is not shown to a reader who doesn't see one of the draft's fields", () => {
      const seen = seenAs(
        teamMember,
        { name: "Fictional Renamed", memberFrom: { [member]: "2026-08-01" } },
        rejected,
      );

      expect(seen).not.toHaveProperty("reason");
    });

    it("is not shown to a role without Personal data when the draft changes someone who has not started", () => {
      const fields = {
        name: "Fictional Renamed",
        members: [lead, member, starter],
      };

      expect(seenAs(teamMember, fields, rejected)).not.toHaveProperty("reason");
      expect(seenAs(workforceAdministrator, fields, rejected)?.reason).toBe(
        "Fictional reason",
      );
    });

    it("is not shown for a waiting draft, or a rejection with no reason", () => {
      const fields = { name: "Fictional Renamed" };

      expect(seenAs(workforceAdministrator, fields)).not.toHaveProperty(
        "reason",
      );
      expect(
        seenAs(workforceAdministrator, fields, {
          state: "rejected",
          reason: null,
        }),
      ).not.toHaveProperty("reason");
    });
  });

  it("is marked as the reader's own when not yet published", () => {
    expect(
      seenAs(
        workforceAdministrator,
        { name: "Fictional Renamed" },
        { unpublished: true },
      )?.unpublished,
    ).toBe(true);
  });

  it("names who made it, and who changed each field", () => {
    // Given a draft made by one editor and changed by another
    const maker: Maker = {
      madeBy: "Fictional Editor",
      madeAs: "Fictional Role",
      madeAt: new Date("2026-06-01T09:00:00.000Z"),
      editors: ["Fictional Maker", "Fictional Editor"],
      fieldEditors: new Map([["name", "Fictional Editor"]]),
      needsOtherApprover: true,
    };

    // When a reader sees it
    const seen = seenAs(
      workforceAdministrator,
      { name: "Fictional Renamed", leadId: member },
      {},
      maker,
    );

    // Then its makers are named, and the field no one is named for has none
    expect(seen).toMatchObject({
      madeBy: "Fictional Editor",
      madeAs: "Fictional Role",
      madeAt: "2026-06-01T09:00:00.000Z",
      editors: ["Fictional Maker", "Fictional Editor"],
      needsOtherApprover: true,
      changedBy: { name: "Fictional Editor", leadId: null },
    });
  });

  it("names no one for a draft written without the change history", () => {
    expect(
      seenAs(workforceAdministrator, { name: "Fictional Renamed" }),
    ).toMatchObject({
      madeBy: null,
      madeAs: null,
      madeAt: null,
      editors: [],
      changedBy: { name: null },
    });
    expect(
      seenAs(workforceAdministrator, { name: "Fictional Renamed" }),
    ).not.toHaveProperty("needsOtherApprover");
  });
});
