// SPDX-License-Identifier: Apache-2.0

// Integration tests for the release streams routes against a PostgreSQL server: who may read and
// change streams, patterns and releases, schedules and their cycles, and who may discard, resend
// and decide their drafts, by role.

import {
  type ChangeHistory,
  horizonFrom,
  type Permission,
  type ReleaseStream,
  type ReleaseStreams,
  type Role,
  roleSchema,
} from "@fathom/shared";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { type TestApp, unique } from "./test-app.ts";
import {
  test,
  configurer,
  planner,
  viewer,
  quarters,
  readStreams,
  readStream,
  draftRelease,
  decide,
  approveAll,
  liveStream,
  firstHalf,
  today,
  closeReleaseTests,
  startReleaseTests,
} from "./test-releases.ts";

beforeAll(startReleaseTests);
afterAll(closeReleaseTests);

describe("reading release streams", () => {
  it("is open to those who see the plan, without changing anything", async () => {
    const response = await test.request(
      viewer.cookie,
      "GET",
      "/api/release-streams",
    );
    expect(response.statusCode).toBe(200);
    expect(response.json<ReleaseStreams>()).toMatchObject({
      canEditStreams: false,
      canEditReleases: false,
    });
  });

  it("shows each schedule's cycles, worked out from its patterns, laid out two years from today", async () => {
    const stream = await liveStream();
    expect(stream.cycles.slice(0, 2)).toEqual([
      expect.objectContaining({
        startsOn: "2027-01-01",
        endsOn: "2027-03-31",
        name: "27.1",
      }),
      expect.objectContaining({ startsOn: "2027-04-01", name: "27.2" }),
    ]);
    const last = stream.cycles.at(-1);
    expect(stream.cyclesUntil).toBe(horizonFrom(today()));
    expect(String(last?.startsOn) <= stream.cyclesUntil).toBe(true);
    expect(String(last?.endsOn) >= stream.cyclesUntil).toBe(true);
  });
});

describe("who may change what", () => {
  let stream: ReleaseStream;
  let release: string;

  beforeAll(async () => {
    stream = await liveStream();
    await draftRelease(stream.id, {
      name: unique("Fictional Guarded"),
      ...firstHalf,
    });
    await approveAll(
      (await readStream(stream.id, planner.cookie)) as ReleaseStream,
    );
    release = String((await readStream(stream.id))?.releases[0]?.id);
  });

  const path = () => `/api/release-streams/${stream.id}`;

  it("shows releases in the change history only to those who see features and releases, and streams also to those who see configuration", async () => {
    const live = await liveStream();
    const name = unique("Fictional Shown");
    await draftRelease(live.id, { name, ...firstHalf });
    await approveAll(
      (await readStream(live.id, planner.cookie)) as ReleaseStream,
    );
    const historyOf = async (permissions: Permission[]) => {
      const reader = await test.signedIn(permissions);
      const response = await test.request(reader.cookie, "GET", "/api/changes");
      return response
        .json<ChangeHistory>()
        .entries.flatMap((entry) => entry.records)
        .map((record) => record.name);
    };

    const configuration = await historyOf(["configuration:view"]);
    const features = await historyOf(["features:view"]);

    expect(configuration).toContain(live.name);
    expect(configuration).not.toContain(name);
    expect(features).toContain(name);
  });

  it("leaves releases out of the streams read by those who see configuration but not features", async () => {
    const live = await liveStream();
    await draftRelease(live.id, {
      name: unique("Fictional Hidden"),
      ...firstHalf,
    });
    await approveAll(
      (await readStream(live.id, planner.cookie)) as ReleaseStream,
    );
    const streamFor = async (permissions: Permission[]) =>
      readStream(live.id, (await test.signedIn(permissions)).cookie);

    const configuration = await streamFor(["configuration:view"]);
    const features = await streamFor(["features:view"]);

    expect(configuration?.cycles.length).toBeGreaterThan(0);
    expect(configuration?.releases).toEqual([]);
    expect(features?.releases).toHaveLength(1);
  });

  it("leaves releases out of a stream answered after a change by one who edits configuration but doesn't see features", async () => {
    const live = await liveStream();
    await draftRelease(live.id, {
      name: unique("Fictional Kept Back"),
      ...firstHalf,
    });
    await approveAll(
      (await readStream(live.id, planner.cookie)) as ReleaseStream,
    );
    const editor = await test.signedIn([
      "configuration:view",
      "configuration:edit",
    ]);

    const response = await test.request(
      editor.cookie,
      "PUT",
      `/api/release-streams/${live.id}`,
      { name: unique("Fictional Renamed Stream") },
    );

    expect(response.statusCode, response.body).toBe(200);
    expect(response.json<{ stream: ReleaseStream }>().stream.releases).toEqual(
      [],
    );
  });

  it("refuses reading streams to those who see neither the plan nor planning configuration", async () => {
    const reader = await test.signedIn("administrator");
    const response = await test.request(
      reader.cookie,
      "GET",
      "/api/release-streams",
    );
    expect(response.statusCode).toBe(403);
  });

  it.each([
    ["changing", "PUT"],
    ["removing", "DELETE"],
  ] as const)(
    "refuses %s a release to those who do not edit the plan",
    async (_name, method) => {
      const response = await test.request(
        configurer.cookie,
        method,
        `${path()}/releases/${release}`,
        method === "PUT" ? { name: "Fictional", ...firstHalf } : undefined,
      );
      expect(response.statusCode).toBe(403);
    },
  );

  it.each([
    ["discarding", "/draft"],
    ["resubmitting", "/draft/rejection"],
  ])(
    "refuses %s a release's draft to those who do not edit the plan",
    async (_name, tail) => {
      const response = await test.request(
        configurer.cookie,
        "DELETE",
        `/api/records/release/${release}${tail}`,
      );
      expect(response.statusCode).toBe(403);
    },
  );
});

// Schedules and their cycles are changed by those who edit the plan or planning configuration, and
// their drafts decided by those who approve either, as Roles sets out.
const scheduleEditors: readonly Role[] = [
  "product-manager",
  "project-manager",
  "engineering-manager",
  "engineering-director",
  "workforce-administrator",
];
const scheduleApprovers: readonly Role[] = [
  "product-manager",
  "project-manager",
  "engineering-director",
];
const others = (allowed: readonly Role[]) =>
  roleSchema.options.filter((role) => !allowed.includes(role));

// Each change to a schedule or its cycles, sent to a live quarterly schedule, retired first when
// restoring it, with the status it is answered with when allowed.
const scheduleChanges: {
  name: string;
  retired?: boolean;
  status: number;
  send: (
    cookie: string,
    stream: ReleaseStream,
  ) => ReturnType<TestApp["request"]>;
}[] = [
  {
    name: "adding a schedule",
    status: 201,
    send: (cookie) =>
      test.request(cookie, "POST", "/api/release-streams", {
        name: unique("Fictional Added"),
      }),
  },
  {
    name: "renaming a schedule",
    status: 200,
    send: (cookie, stream) =>
      test.request(cookie, "PUT", `/api/release-streams/${stream.id}`, {
        name: unique("Fictional Renamed"),
      }),
  },
  {
    name: "retiring a schedule",
    status: 200,
    send: (cookie, stream) =>
      test.request(cookie, "PUT", `/api/release-streams/${stream.id}/retired`, {
        retired: true,
      }),
  },
  {
    name: "restoring a schedule",
    retired: true,
    status: 200,
    send: (cookie, stream) =>
      test.request(cookie, "PUT", `/api/release-streams/${stream.id}/retired`, {
        retired: false,
      }),
  },
  {
    name: "ending a schedule",
    status: 200,
    send: (cookie, stream) =>
      test.request(cookie, "PUT", `/api/release-streams/${stream.id}/ends-on`, {
        endsOn: "2031-12-31",
      }),
  },
  {
    name: "adding a change of cycles",
    status: 201,
    send: (cookie, stream) =>
      test.request(
        cookie,
        "POST",
        `/api/release-streams/${stream.id}/patterns`,
        {
          ...quarters,
          startsOn: "2027-07-01",
          length: 6,
        },
      ),
  },
  {
    name: "changing a change of cycles",
    status: 200,
    send: (cookie, stream) =>
      test.request(
        cookie,
        "PUT",
        `/api/release-streams/${stream.id}/patterns/${String(stream.patterns[0]?.id)}`,
        { ...quarters, naming: "Q{N} {YYYY}" },
      ),
  },
  {
    name: "removing a change of cycles",
    status: 200,
    send: (cookie, stream) =>
      test.request(
        cookie,
        "DELETE",
        `/api/release-streams/${stream.id}/patterns/${String(stream.patterns[0]?.id)}`,
      ),
  },
  {
    name: "changing one cycle's length",
    status: 200,
    send: (cookie, stream) =>
      test.request(
        cookie,
        "PUT",
        `/api/release-streams/${stream.id}/cycles/2027-04-01/length`,
        { length: 2, later: "move" },
      ),
  },
];

describe("who may change schedules and their cycles", () => {
  const allowed = scheduleChanges.flatMap((change) =>
    scheduleEditors.map((role) => ({ ...change, role })),
  );
  const refused = scheduleChanges.flatMap((change) =>
    others(scheduleEditors).map((role) => ({ ...change, role })),
  );

  it.each(allowed)(
    "allows $name to $role",
    async ({ role, retired, status, send }) => {
      const stream = await liveStream();
      if (retired === true) {
        await test.request(
          configurer.cookie,
          "PUT",
          `/api/release-streams/${stream.id}/retired`,
          { retired: true },
        );
        await approveAll((await readStream(stream.id)) as ReleaseStream);
      }
      const { cookie } = await test.signedIn(role);

      const response = await send(
        cookie,
        (await readStream(stream.id)) as ReleaseStream,
      );

      expect(response.statusCode, response.body).toBe(status);
    },
  );

  it.each(refused)(
    "refuses $name to $role, changing nothing",
    async ({ role, send }) => {
      const stream = await liveStream();
      const { cookie } = await test.signedIn(role);

      const response = await send(cookie, stream);

      expect(response.statusCode, response.body).toBe(403);
      expect(await readStream(stream.id)).toEqual(stream);
    },
  );

  it.each(scheduleEditors)(
    "tells %s they may change schedules",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      expect((await readStreams(cookie)).canEditStreams).toBe(true);
    },
  );

  it.each(others(scheduleEditors).filter((role) => role !== "administrator"))(
    "tells %s they may not change schedules",
    async (role) => {
      const { cookie } = await test.signedIn(role);
      expect((await readStreams(cookie)).canEditStreams).toBe(false);
    },
  );

  it("refuses changing a schedule to one who edits the plan but sees neither features nor planning configuration", async () => {
    const stream = await liveStream();
    const editor = await test.signedIn(["plan:edit"]);

    const response = await test.request(
      editor.cookie,
      "PUT",
      `/api/release-streams/${stream.id}`,
      { name: unique("Fictional Unseen") },
    );

    expect(response.statusCode).toBe(403);
  });
});

// A live schedule renamed, or its cycles renamed, by the Workforce Administrator, as a draft waiting
// for approval.
const drafted = {
  schedule: async () => {
    const stream = await liveStream();
    await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${stream.id}`,
      { name: unique("Fictional Drafted") },
    );
    return { type: "release-stream", id: stream.id };
  },
  "change of cycles": async () => {
    const stream = await liveStream();
    const id = String(stream.patterns[0]?.id);
    await test.request(
      configurer.cookie,
      "PUT",
      `/api/release-streams/${stream.id}/patterns/${id}`,
      { ...quarters, naming: "Q{N} {YYYY}" },
    );
    return { type: "cycle-pattern", id };
  },
};
const draftedKinds = Object.entries(drafted);

// A schedule's or a change of cycles' draft, if it has one.
const draftOf = async ({ type, id }: { type: string; id: string }) => {
  const stream = (await readStreams()).streams.find(
    (each) =>
      each.id === id || each.patterns.some((pattern) => pattern.id === id),
  );
  return type === "release-stream"
    ? stream?.draft
    : stream?.patterns.find((pattern) => pattern.id === id)?.draft;
};

describe("who may discard and resend drafts of schedules and their cycles", () => {
  // Another user's draft, rejected when it is to be resent.
  const handlings = [
    {
      handling: "discard",
      tail: "/draft",
      rejected: false,
      after: undefined,
      kept: { state: "waiting" },
    },
    {
      handling: "resend",
      tail: "/draft/rejection",
      rejected: true,
      after: { state: "waiting" },
      kept: { state: "rejected" },
    },
  ] as const;
  const cases = (roles: readonly Role[]) =>
    draftedKinds.flatMap(([kind, draft]) =>
      handlings.flatMap((handling) =>
        roles.map((role) => ({ kind, draft, ...handling, role })),
      ),
    );
  const prepare = async (
    draft: () => Promise<{ type: string; id: string }>,
    rejected: boolean,
  ) => {
    const record = await draft();
    if (rejected) {
      await decide("rejection", { records: [record], reason: "Not yet" });
    }
    return record;
  };

  // Another's draft of a schedule is discarded only by one who changed it, while one of its cycles is
  // discarded by any role that changes cycles.
  const othersMay = ({ kind, handling }: { kind: string; handling: string }) =>
    kind !== "schedule" || handling !== "discard";

  it.each(cases(scheduleEditors).filter(othersMay))(
    "lets $role $handling another's draft of a $kind",
    async ({ draft, tail, rejected, after, role }) => {
      const record = await prepare(draft, rejected);
      const { cookie } = await test.signedIn(role);

      const response = await test.request(
        cookie,
        "DELETE",
        `/api/records/${record.type}/${record.id}${tail}`,
      );

      expect(response.statusCode, response.body).toBe(200);
      const left = await draftOf(record);
      if (after === undefined) expect(left).toBeUndefined();
      else expect(left).toMatchObject(after);
    },
  );

  it.each([
    ...cases(others(scheduleEditors)),
    ...cases(scheduleEditors).filter((one) => !othersMay(one)),
  ])(
    "refuses $role to $handling another's draft of a $kind",
    async ({ draft, tail, rejected, kept, role }) => {
      const record = await prepare(draft, rejected);
      const { cookie } = await test.signedIn(role);

      const response = await test.request(
        cookie,
        "DELETE",
        `/api/records/${record.type}/${record.id}${tail}`,
      );

      expect(response.statusCode, response.body).toBe(403);
      expect(await draftOf(record)).toMatchObject(kept);
    },
  );
});

describe("who may decide drafts of schedules and their cycles", () => {
  const askings = [
    { asking: "approval", body: {} },
    { asking: "rejection", body: { reason: "Fictional reason" } },
  ] as const;
  const cases = (roles: readonly Role[]) =>
    draftedKinds.flatMap(([kind, draft]) =>
      askings.flatMap(({ asking, body }) =>
        roles.map((role) => ({ kind, draft, asking, body, role })),
      ),
    );

  it.each(cases(scheduleApprovers))(
    "lets $role decide a $kind's draft by $asking",
    async ({ draft, asking, body, role }) => {
      const record = await draft();
      const { cookie } = await test.signedIn(role);

      const response = await test.request(
        cookie,
        "POST",
        `/api/drafts/${asking}`,
        {
          records: [record],
          ...body,
        },
      );

      expect(response.statusCode, response.body).toBe(200);
    },
  );

  it.each(cases(others(scheduleApprovers)))(
    "refuses $role deciding a $kind's draft by $asking",
    async ({ draft, asking, body, role }) => {
      const record = await draft();
      const { cookie } = await test.signedIn(role);

      const response = await test.request(
        cookie,
        "POST",
        `/api/drafts/${asking}`,
        {
          records: [record],
          ...body,
        },
      );

      expect(response.statusCode, response.body).toBe(403);
      expect(await draftOf(record)).toMatchObject({ state: "waiting" });
    },
  );

  it.each([
    ["Approve Plan", ["plan:approve", "features:view"]],
    ["Approve Configuration", ["configuration:approve", "configuration:view"]],
  ] as const)(
    "puts a %s holder's one approval of a schedule's and its cycles' drafts live",
    async (_name, permissions) => {
      const schedule = await drafted.schedule();
      const cycles = await drafted["change of cycles"]();
      const decider = await test.signedIn([...permissions]);

      const response = await test.request(
        decider.cookie,
        "POST",
        "/api/drafts/approval",
        {
          records: [schedule, cycles],
        },
      );

      expect(response.statusCode, response.body).toBe(200);
      expect(await draftOf(schedule)).toBeUndefined();
      expect(await draftOf(cycles)).toBeUndefined();
    },
  );

  it("refuses an Approver of features and releases alone, naming the plan and configuration", async () => {
    const record = await drafted.schedule();
    const decider = await test.signedIn(["features:approve", "features:view"]);

    const response = await test.request(
      decider.cookie,
      "POST",
      "/api/drafts/approval",
      {
        records: [record],
      },
    );

    expect(response.statusCode).toBe(403);
    expect(response.json<{ error: string }>().error).toBe(
      "This role can't approve drafts of the plan or configuration",
    );
  });
});
