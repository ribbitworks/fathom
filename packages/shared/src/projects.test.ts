// SPDX-License-Identifier: Apache-2.0

// Tests for projects' dates from their milestones, the requests that add and change the plan's
// records, a feature's projects and proposals, the reasons kept for features removed from a
// proposal, the records naming a record, and a customer's links.

import { describe, expect, it } from "vitest";
import { draftsAtOnce } from "./drafts.ts";
import {
  addedRecordsSchema,
  customerFeatures,
  customerKeptBy,
  customerNamers,
  featureKeptBy,
  customerRequestSchema,
  featureProjectsRequestSchema,
  milestoneAddingSchema,
  milestoneRequestSchema,
  namedBy,
  projectDates,
  projectKeptBy,
  projectRequestSchema,
  projectLengths,
  projectSubjects,
  proposalKeptBy,
  proposalRequestSchema,
  releaseKeptBy,
  removalReasonRequestSchema,
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
  it("name a customer, with no description or note unless given", () => {
    expect(customerRequestSchema.parse({ name: " Fictional " })).toEqual({
      name: "Fictional",
      description: null,
      note: null,
    });
    expect(customerRequestSchema.safeParse({ name: " " }).success).toBe(false);
  });

  it("trim a customer's description, taking an empty one as none, and refuse one too long", () => {
    const described = (description: string) =>
      customerRequestSchema.safeParse({ name: "Fictional", description });

    expect([
      described(" Ferries ").data?.description,
      described("  ").data?.description,
      described("a".repeat(projectLengths.customerDescription + 1)).success,
    ]).toEqual(["Ferries", null, false]);
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

  it("add a milestone to the project named, and only to one", () => {
    const projectId = "00000000-0000-4000-8000-000000000001";
    const milestone = { name: "Fictional", date: "2027-01-04" };
    expect(
      milestoneAddingSchema.parse({ ...milestone, projectId }).projectId,
    ).toBe(projectId);
    expect(milestoneAddingSchema.safeParse(milestone).success).toBe(false);
  });

  it("add from one record to as many as can be added at once", () => {
    const adding = addedRecordsSchema(customerRequestSchema);
    const records = (count: number) =>
      Array.from({ length: count }, () => ({ name: "Fictional" }));
    expect(adding.safeParse({ records: records(1) }).success).toBe(true);
    expect(adding.safeParse({ records: records(draftsAtOnce) }).success).toBe(
      true,
    );
    expect(adding.safeParse({ records: [] }).success).toBe(false);
    expect(
      adding.safeParse({ records: records(draftsAtOnce + 1) }).success,
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

  it("take no reason for removing a feature, which is given afterwards", () => {
    expect(
      featureProjectsRequestSchema.parse({ removalReason: "Too costly" }),
    ).toEqual({});
  });
});

describe("the reason for removing a feature from a proposal", () => {
  it("is kept trimmed, and an empty one as none", () => {
    expect(
      removalReasonRequestSchema.parse({ removalReason: " Too costly " }),
    ).toEqual({ removalReason: "Too costly" });
    expect(removalReasonRequestSchema.parse({ removalReason: " " })).toEqual({
      removalReason: null,
    });
    expect(removalReasonRequestSchema.parse({})).toEqual({
      removalReason: null,
    });
  });

  it("is refused when too long to read beside the removal", () => {
    const removalReason = "a".repeat(projectLengths.removalReason + 1);
    expect(
      removalReasonRequestSchema.safeParse({ removalReason }).success,
    ).toBe(false);
  });
});

describe("the reasons kept for features removed from a proposal", () => {
  it("give a feature removed now no reason, dropping any it had", () => {
    expect(
      removalReasonsAfter({ [first]: "Old reason" }, [first, second], []),
    ).toEqual({});
  });

  it("keep the reasons of features removed before", () => {
    expect(
      removalReasonsAfter({ [first]: "Too costly" }, [second], []),
    ).toEqual({ [first]: "Too costly" });
  });

  it("drop the reason of a feature proposed again", () => {
    expect(removalReasonsAfter({ [first]: "Too costly" }, [], [first])).toEqual(
      {},
    );
  });
});

describe("subjects", () => {
  it("name each kind of record as drafts do", () => {
    expect(projectSubjects.customer("Fictional")).toBe(
      "the customer Fictional",
    );
    expect(projectSubjects.project("Fictional")).toBe("the project Fictional");
    expect(projectSubjects.activity("Testing", "Fictional")).toBe(
      "the activity Testing of Fictional",
    );
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

describe("the records naming a record", () => {
  const customer = "customer";
  const feature = "feature";
  const proposal = "proposal";
  const naming = {
    id: "naming",
    customerIds: [customer],
    proposalIds: [proposal],
    featureIds: [feature],
  };
  const unlinked = {
    id: "unlinked",
    customerIds: [],
    proposalIds: [],
    featureIds: [],
  };

  it.each([
    ["customerIds", customer],
    ["proposalIds", proposal],
    ["featureIds", feature],
  ] as const)(
    "are those naming it through %s, in the order given",
    (link, id) => {
      const later = { ...naming, id: "later" };
      expect(namedBy([naming, unlinked, later], link, id)).toEqual([
        naming,
        later,
      ]);
    },
  );

  it("are none when nothing names it through that link", () => {
    expect(namedBy([naming], "proposalIds", customer)).toEqual([]);
  });

  it("follow a draft adding a link and one taking it away, as the records given show them", () => {
    const linkedByDraft = {
      ...unlinked,
      customerIds: [customer],
      draft: { live: { customerIds: [] } },
    };
    const unlinkedByDraft = {
      ...naming,
      customerIds: [],
      draft: { live: { customerIds: [customer] } },
    };
    expect(
      namedBy([linkedByDraft, unlinkedByDraft], "customerIds", customer),
    ).toEqual([linkedByDraft]);
  });
});

describe("a customer's links", () => {
  const customer = "customer";
  const other = "other";
  const namerOf = (
    id: string,
    customerIds: string[],
    featureIds: string[],
  ) => ({
    id,
    customerIds,
    featureIds,
  });
  const featureOf = (id: string, customerIds: string[] = []) => ({
    id,
    customerIds,
  });
  const links = {
    projects: [
      namerOf("project", [customer], ["needed", "both"]),
      namerOf("other project", [other], ["elsewhere"]),
    ],
    proposals: [namerOf("proposal", [customer, other], ["proposed", "both"])],
    features: [
      featureOf("elsewhere"),
      featureOf("proposed"),
      featureOf("direct", [customer]),
      featureOf("both", [customer]),
      featureOf("needed"),
      featureOf("unnamed"),
    ],
  };

  it("name its projects, its proposals and the features naming it directly", () => {
    const namers = customerNamers(links, customer);
    expect(namers.projects.map(({ id }) => id)).toEqual(["project"]);
    expect(namers.proposals.map(({ id }) => id)).toEqual(["proposal"]);
    expect(namers.features.map(({ id }) => id)).toEqual(["direct", "both"]);
  });

  it("give every feature it gets or asks for once, in the features' order", () => {
    expect(customerFeatures(links, customer).map(({ id }) => id)).toEqual([
      "proposed",
      "direct",
      "both",
      "needed",
    ]);
  });

  it("leave out features a project names that the reader isn't sent", () => {
    expect(customerFeatures({ ...links, features: [] }, customer)).toEqual([]);
  });

  it("give a customer nothing names nothing", () => {
    expect(customerNamers(links, "unnamed")).toEqual({
      projects: [],
      proposals: [],
      features: [],
    });
    expect(customerFeatures(links, "unnamed")).toEqual([]);
  });
});

describe("what keeps a customer from being removed", () => {
  const customer = "customer";
  const named = (id: string, customerIds: string[] = [customer]) => ({
    id,
    customerIds,
    featureIds: [],
  });
  const removed = { draft: { action: "deleted" } };
  const links = {
    projects: [named("other project", ["other"]), named("project")],
    proposals: [named("proposal")],
    features: [named("feature")],
  };

  it("are its projects, then its proposals, then the features naming it", () => {
    expect(customerKeptBy(links, customer).map(({ id }) => id)).toEqual([
      "project",
      "proposal",
      "feature",
    ]);
  });

  it("leaves out records drafted to be removed", () => {
    expect(
      customerKeptBy(
        {
          projects: [{ ...named("project"), ...removed }],
          proposals: [{ ...named("proposal"), ...removed }],
          features: [{ ...named("feature"), ...removed }],
        },
        customer,
      ),
    ).toEqual([]);
  });

  it("keeps records a draft changes in other ways", () => {
    expect(
      customerKeptBy(
        {
          projects: [{ ...named("project"), draft: { action: "changed" } }],
          proposals: [],
          features: [],
        },
        customer,
      ).map(({ id }) => id),
    ).toEqual(["project"]);
  });

  it("is none when nothing names it", () => {
    expect(customerKeptBy(links, "unnamed")).toEqual([]);
  });
});

describe("what keeps a proposal, a feature, a project or a release from being removed", () => {
  const removed = { draft: { action: "deleted" } };
  const namer = (
    id: string,
    { proposalIds = [] as string[], featureIds = [] as string[] } = {},
  ) => ({ id, proposalIds, featureIds });

  it("is, for a proposal, the projects naming it, leaving out those drafted to be removed", () => {
    expect(
      proposalKeptBy(
        {
          projects: [
            namer("other", { proposalIds: ["elsewhere"] }),
            namer("project", { proposalIds: ["proposal"] }),
            { ...namer("gone", { proposalIds: ["proposal"] }), ...removed },
          ],
        },
        "proposal",
      ).map(({ id }) => id),
    ).toEqual(["project"]);
  });

  it("is, for a feature, the projects needing it, then the proposals proposing it", () => {
    expect(
      featureKeptBy(
        {
          projects: [namer("project", { featureIds: ["feature"] })],
          proposals: [
            namer("proposal", { featureIds: ["feature"] }),
            { ...namer("gone", { featureIds: ["feature"] }), ...removed },
          ],
        },
        "feature",
      ).map(({ id }) => id),
    ).toEqual(["project", "proposal"]);
  });

  it("is, for a project, the activities naming it", () => {
    expect(
      projectKeptBy(
        {
          activities: [
            { id: "activity", projectId: "project" },
            { id: "other", projectId: null },
            { id: "gone", projectId: "project", ...removed },
          ],
        },
        "project",
      ).map(({ id }) => id),
    ).toEqual(["activity"]);
  });

  it("is, for a release, the activities naming it", () => {
    expect(
      releaseKeptBy(
        {
          activities: [
            { id: "activity", releaseId: "release" },
            { id: "other", releaseId: null },
            { id: "gone", releaseId: "release", ...removed },
          ],
        },
        "release",
      ).map(({ id }) => id),
    ).toEqual(["activity"]);
  });
});
