// SPDX-License-Identifier: Apache-2.0

// Tests for projects' dates from their milestones, and the requests that add and change customers,
// projects, milestones, and proposals, a feature's projects and proposals, and the reasons kept for
// features removed from a proposal.

import { describe, expect, it } from "vitest";
import {
  customerRequestSchema,
  featureProjectsRequestSchema,
  milestoneRequestSchema,
  projectDates,
  projectRequestSchema,
  projectLengths,
  projectSubjects,
  proposalRequestSchema,
  removalReasonsAfter,
  removalReasonsIn,
  sameDates,
  withRemovalReason,
} from "./projects.ts";

const first = "00000000-0000-4000-8000-000000000001";
const second = "00000000-0000-4000-8000-000000000002";

describe("a project's dates", () => {
  it("are none without milestones", () => {
    expect(projectDates([], "2026-11-08")).toEqual({
      first: null,
      last: null,
      nextDelivery: null,
    });
  });

  it("run from its first milestone to its last, with its next customer delivery from today", () => {
    expect(
      projectDates(
        [
          { date: "2027-03-01", customerDelivery: true },
          { date: "2026-01-01", customerDelivery: true },
          { date: "2026-11-08", customerDelivery: true },
          { date: "2026-12-01", customerDelivery: false },
        ],
        "2026-11-08",
      ),
    ).toEqual({
      first: "2026-01-01",
      last: "2027-03-01",
      nextDelivery: "2026-11-08",
    });
  });

  it("have no next customer delivery once every delivery has passed", () => {
    expect(
      projectDates(
        [{ date: "2026-01-01", customerDelivery: true }],
        "2026-11-08",
      ).nextDelivery,
    ).toBeNull();
  });

  it("are the same only when each date is", () => {
    const dates = { first: "2026-01-01", last: null, nextDelivery: null };
    expect(sameDates(dates, { ...dates })).toBe(true);
    expect(sameDates(dates, { ...dates, last: "2026-01-01" })).toBe(false);
    expect(sameDates(dates, { ...dates, first: null })).toBe(false);
    expect(sameDates(dates, { ...dates, nextDelivery: "2026-01-01" })).toBe(
      false,
    );
  });
});

describe("requests", () => {
  it("name a customer", () => {
    expect(customerRequestSchema.parse({ name: " Fictional " })).toEqual({
      name: "Fictional",
    });
    expect(customerRequestSchema.safeParse({ name: " " }).success).toBe(false);
  });

  it("give a project no ID when it is empty, and its picks each once, in order", () => {
    expect(
      projectRequestSchema.parse({
        name: "Fictional",
        externalId: " ",
        customerIds: [second, first, second],
      }),
    ).toEqual({
      name: "Fictional",
      externalId: null,
      ownerId: null,
      customerIds: [first, second],
      proposalIds: [],
      featureIds: [],
    });
    expect(
      projectRequestSchema.parse({ name: "Fictional", externalId: " P-1 " })
        .externalId,
    ).toBe("P-1");
  });

  it("give a milestone a day, not a customer delivery unless asked", () => {
    expect(
      milestoneRequestSchema.parse({ name: "Fictional", date: "2027-01-04" }),
    ).toEqual({
      name: "Fictional",
      date: "2027-01-04",
      customerDelivery: false,
    });
    expect(
      milestoneRequestSchema.safeParse({ name: "Fictional", date: "soon" })
        .success,
    ).toBe(false);
  });

  it("keep a proposal's web link as Fathom keeps links, and refuse others", () => {
    const parse = (link: string | null | undefined) =>
      proposalRequestSchema.safeParse({ name: "Fictional", link });
    expect(parse("example.com/bid").data?.link).toBe("https://example.com/bid");
    expect(parse("").data?.link).toBeNull();
    expect(parse(null).data?.link).toBeNull();
    expect(parse(undefined).data?.link).toBeNull();
    expect(parse("javascript:alert(1)").success).toBe(false);
    expect(parse(`https://example.com/${"a".repeat(2000)}`).success).toBe(
      false,
    );
  });
});

describe("a feature's projects and proposals", () => {
  it("are each kept once, in a stable order", () => {
    expect(
      featureProjectsRequestSchema.parse({
        projectIds: [second, first, second],
        proposalIds: [],
      }),
    ).toEqual({ projectIds: [first, second], proposalIds: [] });
  });

  it("leave a kind not named out, rather than empty", () => {
    expect(
      featureProjectsRequestSchema.parse({ proposalIds: [first] }),
    ).toEqual({ proposalIds: [first] });
  });

  it("refuse what is not an identifier", () => {
    expect(
      featureProjectsRequestSchema.safeParse({ projectIds: ["not-an-id"] })
        .success,
    ).toBe(false);
  });

  it("keep a reason for removing it trimmed, and an empty one as none", () => {
    expect(
      featureProjectsRequestSchema.parse({ removalReason: " Too costly " }),
    ).toEqual({ removalReason: "Too costly" });
    expect(featureProjectsRequestSchema.parse({ removalReason: " " })).toEqual({
      removalReason: null,
    });
  });

  it("refuse a reason too long to read beside the removal", () => {
    const removalReason = "a".repeat(projectLengths.removalReason + 1);
    expect(
      featureProjectsRequestSchema.safeParse({ removalReason }).success,
    ).toBe(false);
  });
});

describe("the reasons kept for features removed from a proposal", () => {
  it("give each feature removed the reason given", () => {
    expect(
      removalReasonsAfter({}, [first, second], [], "Too costly", [
        first,
        second,
      ]),
    ).toEqual({
      [first]: "Too costly",
      [second]: "Too costly",
    });
  });

  it("keep no reason for a feature removed without one", () => {
    expect(
      removalReasonsAfter({ [first]: "Old reason" }, [first], [], null, [
        first,
      ]),
    ).toEqual({});
  });

  it("keep the reasons of features removed before", () => {
    expect(
      removalReasonsAfter({ [first]: "Too costly" }, [second], [], null, [
        second,
      ]),
    ).toEqual({ [first]: "Too costly" });
  });

  it("give no reason to a feature only a draft added, then removed", () => {
    expect(removalReasonsAfter({}, [first], [], "Too costly", [])).toEqual({});
  });

  it("drop the reason of a feature proposed again", () => {
    expect(
      removalReasonsAfter({ [first]: "Too costly" }, [], [first], null, []),
    ).toEqual({});
  });
});

describe("subjects", () => {
  it("name each kind of record as drafts do", () => {
    expect(projectSubjects.customer("Fictional")).toBe(
      "the customer Fictional",
    );
    expect(projectSubjects.project("Fictional")).toBe("the project Fictional");
    expect(projectSubjects.milestone("Kickoff", "Fictional")).toBe(
      "the milestone Kickoff of Fictional",
    );
    expect(projectSubjects.proposal("Fictional")).toBe(
      "the proposal Fictional",
    );
  });
});

describe("changing the reason for removing one feature", () => {
  it("sets the reason for that feature, keeping the others", () => {
    expect(
      withRemovalReason({ [first]: "Too costly" }, second, "Out of scope"),
    ).toEqual({ [first]: "Too costly", [second]: "Out of scope" });
  });

  it("replaces the reason the feature had", () => {
    expect(
      withRemovalReason({ [first]: "Too costly" }, first, "Later"),
    ).toEqual({ [first]: "Later" });
  });

  it("clears the reason when none is given", () => {
    expect(
      withRemovalReason(
        { [first]: "Too costly", [second]: "Later" },
        first,
        null,
      ),
    ).toEqual({ [second]: "Later" });
  });
});

describe("values as stored", () => {
  it("read reasons by feature, and nothing from anything else", () => {
    expect(removalReasonsIn({ [first]: "Too costly" })).toEqual({
      [first]: "Too costly",
    });
    expect(removalReasonsIn(null)).toEqual({});
    expect(removalReasonsIn({ [first]: 3 })).toEqual({});
  });
});
