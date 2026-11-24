// SPDX-License-Identifier: Apache-2.0

// Tests of the plan against a real PostgreSQL server: release streams, their patterns and releases,
// features with their targets, estimates and milestones, and activities.

import { randomUUID } from "node:crypto";
import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { databaseCodes } from "./errors.ts";
import {
  addPosition,
  aPosition,
  errorCodeOf,
  firstId,
  withClient,
} from "./test-clients.ts";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
  await withClient(database.app, addPosition);
});

afterAll(async () => {
  await database.remove();
});

// Adds fictional streams with the names given, and gives their ids in order.
async function addStreams(client: Client, ...names: string[]) {
  const ids: string[] = [];
  for (const name of names) {
    const added = await client.query<{ id: string }>(
      "INSERT INTO release_streams (name) VALUES ($1) RETURNING id",
      [name],
    );
    ids.push(added.rows[0]?.id as string);
  }
  return ids;
}

describe("release streams", () => {
  const { uniqueViolation, checkViolation, restrictViolation } = databaseCodes;

  const addPattern = (
    client: Client,
    streamId: string | undefined,
    length = 3,
    unit = "months",
  ) =>
    client.query(
      "INSERT INTO cycle_patterns (stream_id, starts_on, length, unit, naming) VALUES ($1, '2027-01-01', $2, $3, '{YY}.{N}')",
      [streamId, length, unit],
    );

  const addRelease = (
    client: Client,
    streamId: string | undefined,
    name = "Fictional One",
    lastCycle = "2027-04-01",
    shipsOn: string | null = null,
  ) =>
    client.query(
      "INSERT INTO releases (stream_id, name, first_cycle, last_cycle, ships_on) VALUES ($1, $2, '2027-01-01', $3, $4)",
      [streamId, name, lastCycle, shipsOn],
    );

  it("refuses a stream name already used, ignoring letter case", async () => {
    await withClient(database.app, async (client) => {
      await addStreams(client, "Fictional Majors");
      expect(await errorCodeOf(addStreams(client, "fictional majors"))).toBe(
        uniqueViolation,
      );
    });
  });

  it("refuses a release name already in the same stream, ignoring letter case, but not in another", async () => {
    await withClient(database.app, async (client) => {
      const [first, second] = await addStreams(
        client,
        "Fictional Named",
        "Other Fictional Named",
      );
      await addRelease(client, first);
      expect(
        await errorCodeOf(addRelease(client, first, "fictional one")),
      ).toBe(uniqueViolation);
      await addRelease(client, second);
    });
  });

  it("refuses two patterns starting on the same day in the same stream, but not in another", async () => {
    await withClient(database.app, async (client) => {
      const [first, second] = await addStreams(
        client,
        "Fictional Patterned",
        "Other Fictional Patterned",
      );
      await addPattern(client, first);
      expect(await errorCodeOf(addPattern(client, first))).toBe(
        uniqueViolation,
      );
      await addPattern(client, second);
    });
  });

  it("refuses a pattern of no length", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional Lengthless");
      expect(await errorCodeOf(addPattern(client, id, 0))).toBe(checkViolation);
    });
  });

  it("refuses a pattern in a unit other than weeks or months", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional Unknown Unit");
      expect(await errorCodeOf(addPattern(client, id, 2, "days"))).toBe(
        checkViolation,
      );
    });
  });

  it("refuses a release whose last cycle comes before its first", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional Backwards");
      expect(
        await errorCodeOf(addRelease(client, id, "Fictional", "2026-10-01")),
      ).toBe(checkViolation);
    });
  });

  it("refuses a release that ships before its first cycle starts", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional Early");
      expect(
        await errorCodeOf(
          addRelease(client, id, "Fictional", "2027-04-01", "2026-12-31"),
        ),
      ).toBe(checkViolation);
    });
  });

  it("refuses deleting a stream that has a pattern", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional With Pattern");
      await addPattern(client, id);
      expect(
        await errorCodeOf(
          client.query("DELETE FROM release_streams WHERE id = $1", [id]),
        ),
      ).toBe(restrictViolation);
    });
  });

  it("refuses deleting a stream that has a release", async () => {
    await withClient(database.app, async (client) => {
      const [id] = await addStreams(client, "Fictional With Release");
      await addRelease(client, id);
      expect(
        await errorCodeOf(
          client.query("DELETE FROM release_streams WHERE id = $1", [id]),
        ),
      ).toBe(restrictViolation);
    });
  });
});

describe("features", () => {
  const { uniqueViolation, checkViolation, restrictViolation } = databaseCodes;
  const prefix = "Fictional Feature Test";
  const notNullViolation = "23502";
  const anyFeatureStatus =
    "(SELECT i.id FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'feature-statuses' LIMIT 1)";

  afterEach(async () => {
    await withClient(database.app, async (client) => {
      await client.query(`DELETE FROM milestones WHERE name LIKE '${prefix}%'`);
      await client.query(`DELETE FROM features WHERE name LIKE '${prefix}%'`);
      await client.query(`DELETE FROM projects WHERE name LIKE '${prefix}%'`);
      await client.query(`DELETE FROM proposals WHERE name LIKE '${prefix}%'`);
      await client.query(
        `DELETE FROM release_streams WHERE name LIKE '${prefix}%'`,
      );
      await client.query(
        `DELETE FROM feature_teams WHERE name LIKE '${prefix}%'`,
      );
    });
  });

  const addProject = (client: Client, name = `${prefix} Project`) =>
    firstId(client, "INSERT INTO projects (name) VALUES ($1) RETURNING id", [
      name,
    ]);

  const addStream = async (client: Client) => {
    const [id] = await addStreams(client, `${prefix} Stream`);
    return id as string;
  };

  const addTeam = (client: Client) =>
    firstId(
      client,
      "INSERT INTO feature_teams (name) VALUES ($1) RETURNING id",
      [`${prefix} Team`],
    );

  const addFeature = (client: Client, name: string | null = `${prefix} One`) =>
    client.query(
      `INSERT INTO features (status_id, name) VALUES (${anyFeatureStatus}, $1)`,
      [name],
    );

  const addFeatureId = (client: Client) =>
    firstId(
      client,
      `INSERT INTO features (status_id, name) VALUES (${anyFeatureStatus}, $1) RETURNING id`,
      [`${prefix} One`],
    );

  const addTarget = (
    client: Client,
    stream: string | null,
    cycle: string | null,
  ) =>
    client.query(
      `INSERT INTO features (status_id, name, target_stream_id, target_cycle) VALUES (${anyFeatureStatus}, $1, $2, $3)`,
      [`${prefix} One`, stream, cycle],
    );

  const addEstimate = (client: Client, hours: string) =>
    client.query(
      `INSERT INTO features (status_id, name, estimate_hours) VALUES (${anyFeatureStatus}, $1, $2)`,
      [`${prefix} One`, hours],
    );

  const addMilestone = (
    client: Client,
    project: string | null,
    feature: string | null,
  ) =>
    client.query(
      "INSERT INTO milestones (name, date, project_id, feature_id) VALUES ($1, '2027-03-01', $2, $3)",
      [`${prefix} Milestone`, project, feature],
    );

  const removeRow = (client: Client, table: string, id: string) =>
    client.query(`DELETE FROM ${table} WHERE id = $1`, [id]);

  const countMilestones = async (client: Client) => {
    const counted = await client.query<{ count: number }>(
      `SELECT count(*)::int AS count FROM milestones WHERE name LIKE '${prefix}%'`,
    );
    return counted.rows;
  };

  it("starts a feature with nothing but its status filled in", async () => {
    await withClient(database.app, async (client) => {
      await addFeature(client);
      const added = await client.query(
        `SELECT needed_by, customer_ids, note, target_stream_id, target_cycle, estimate_hours, feature_team_id, description FROM features WHERE name = '${prefix} One'`,
      );
      expect(added.rows).toEqual([
        {
          needed_by: null,
          customer_ids: [],
          note: null,
          target_stream_id: null,
          target_cycle: null,
          estimate_hours: null,
          feature_team_id: null,
          description: null,
        },
      ]);
    });
  });

  it("keeps features' names unique, ignoring letter case", async () => {
    await withClient(database.app, async (client) => {
      await addFeature(client);
      expect(await errorCodeOf(addFeature(client, `${prefix} ONE`))).toBe(
        uniqueViolation,
      );
    });
  });

  it("refuses a feature with no name", async () => {
    await withClient(database.app, async (client) => {
      expect(await errorCodeOf(addFeature(client, null))).toBe(
        notNullViolation,
      );
    });
  });

  it("starts with one feature status for each meaning, in order", async () => {
    await withClient(database.app, async (client) => {
      const statuses = await client.query(
        "SELECT i.label, i.meaning FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'feature-statuses' ORDER BY i.position",
      );
      expect(statuses.rows).toEqual([
        { label: "Possible", meaning: "possible" },
        { label: "Planned", meaning: "planned" },
        { label: "In progress", meaning: "in-progress" },
        { label: "Done", meaning: "done" },
        { label: "Cancelled", meaning: "cancelled" },
      ]);
    });
  });

  it("keeps a status a feature has from being deleted", async () => {
    await withClient(database.app, async (client) => {
      await addFeature(client);
      expect(
        await errorCodeOf(
          client.query(
            `DELETE FROM list_items WHERE id = (SELECT status_id FROM features WHERE name = '${prefix} One')`,
          ),
        ),
      ).toBe(restrictViolation);
    });
  });

  it.each(["2027-13", "2027-00", "2027-3", "March"])(
    "refuses %s as the month a feature is needed by",
    async (month) => {
      await withClient(database.app, async (client) => {
        expect(
          await errorCodeOf(
            client.query(
              `INSERT INTO features (status_id, name, needed_by) VALUES (${anyFeatureStatus}, $1, $2)`,
              [`${prefix} One`, month],
            ),
          ),
        ).toBe(checkViolation);
      });
    },
  );

  it("holds no empty note", async () => {
    await withClient(database.app, async (client) => {
      expect(
        await errorCodeOf(
          client.query(
            `INSERT INTO features (status_id, name, note) VALUES (${anyFeatureStatus}, $1, '')`,
            [`${prefix} One`],
          ),
        ),
      ).toBe(checkViolation);
    });
  });

  it("targets a cycle by its stream and start date", async () => {
    await withClient(database.app, async (client) => {
      const streamId = await addStream(client);
      await addTarget(client, streamId, "2027-01-01");
      const added = await client.query(
        `SELECT target_stream_id FROM features WHERE name = '${prefix} One'`,
      );
      expect(added.rows).toEqual([{ target_stream_id: streamId }]);
    });
  });

  it("refuses a target stream with no start date", async () => {
    await withClient(database.app, async (client) => {
      const streamId = await addStream(client);
      expect(await errorCodeOf(addTarget(client, streamId, null))).toBe(
        checkViolation,
      );
    });
  });

  it("refuses a target start date with no stream", async () => {
    await withClient(database.app, async (client) => {
      expect(await errorCodeOf(addTarget(client, null, "2027-01-01"))).toBe(
        checkViolation,
      );
    });
  });

  it("rounds an estimate to two decimal places", async () => {
    await withClient(database.app, async (client) => {
      await addEstimate(client, "12.345");
      const added = await client.query(
        `SELECT estimate_hours FROM features WHERE name = '${prefix} One'`,
      );
      expect(added.rows).toEqual([{ estimate_hours: "12.35" }]);
    });
  });

  it("accepts an estimate of zero", async () => {
    await withClient(database.app, async (client) => {
      await addEstimate(client, "0");
      const added = await client.query(
        `SELECT estimate_hours FROM features WHERE name = '${prefix} One'`,
      );
      expect(added.rows).toEqual([{ estimate_hours: "0.00" }]);
    });
  });

  it.each(["-1", "NaN"])("refuses the estimate %s", async (hours) => {
    await withClient(database.app, async (client) => {
      expect(await errorCodeOf(addEstimate(client, hours))).toBe(
        checkViolation,
      );
    });
  });

  it("holds no empty description", async () => {
    await withClient(database.app, async (client) => {
      expect(
        await errorCodeOf(
          client.query(
            `INSERT INTO features (status_id, name, description) VALUES (${anyFeatureStatus}, $1, '')`,
            [`${prefix} One`],
          ),
        ),
      ).toBe(checkViolation);
    });
  });

  it("keeps a stream a feature targets from being deleted", async () => {
    await withClient(database.app, async (client) => {
      const streamId = await addStream(client);
      await addTarget(client, streamId, "2027-01-01");
      expect(
        await errorCodeOf(removeRow(client, "release_streams", streamId)),
      ).toBe(restrictViolation);
    });
  });

  it("keeps a feature team with features from being deleted", async () => {
    await withClient(database.app, async (client) => {
      const teamId = await addTeam(client);
      await client.query(
        `INSERT INTO features (status_id, name, feature_team_id) VALUES (${anyFeatureStatus}, $1, $2)`,
        [`${prefix} One`, teamId],
      );
      expect(
        await errorCodeOf(removeRow(client, "feature_teams", teamId)),
      ).toBe(restrictViolation);
    });
  });

  it("lets a milestone belong to a project", async () => {
    await withClient(database.app, async (client) => {
      await addMilestone(client, await addProject(client), null);
      expect(await countMilestones(client)).toEqual([{ count: 1 }]);
    });
  });

  it("lets a milestone belong to a feature", async () => {
    await withClient(database.app, async (client) => {
      await addMilestone(client, null, await addFeatureId(client));
      expect(await countMilestones(client)).toEqual([{ count: 1 }]);
    });
  });

  it("refuses a milestone of both a project and a feature", async () => {
    await withClient(database.app, async (client) => {
      const projectId = await addProject(client);
      const featureId = await addFeatureId(client);
      expect(
        await errorCodeOf(addMilestone(client, projectId, featureId)),
      ).toBe(checkViolation);
    });
  });

  it("refuses a milestone of neither a project nor a feature", async () => {
    await withClient(database.app, async (client) => {
      expect(await errorCodeOf(addMilestone(client, null, null))).toBe(
        checkViolation,
      );
    });
  });

  it("keeps a feature with milestones from being deleted", async () => {
    await withClient(database.app, async (client) => {
      const featureId = await addFeatureId(client);
      await addMilestone(client, null, featureId);
      expect(await errorCodeOf(removeRow(client, "features", featureId))).toBe(
        restrictViolation,
      );
    });
  });

  it("starts projects and proposals with no features", async () => {
    await withClient(database.app, async (client) => {
      await addProject(client);
      await client.query(
        "INSERT INTO proposals (name, status_id) SELECT $1, i.id FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'proposal-statuses' AND i.label = 'Open'",
        [`${prefix} Proposal`],
      );
      const linked = await client.query(
        `SELECT feature_ids FROM projects WHERE name = '${prefix} Project' UNION ALL SELECT feature_ids FROM proposals WHERE name = '${prefix} Proposal'`,
      );
      expect(linked.rows).toEqual([{ feature_ids: [] }, { feature_ids: [] }]);
    });
  });
});

describe("activities", () => {
  const { uniqueViolation, checkViolation, restrictViolation } = databaseCodes;
  const prefix = "Fictional Activity Test";
  const anyFeatureStatus =
    "(SELECT i.id FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'feature-statuses' LIMIT 1)";

  afterEach(async () => {
    await withClient(database.app, async (client) => {
      await client.query(
        `DELETE FROM allocations WHERE person_id IN (SELECT id FROM people WHERE preferred_name LIKE '${prefix}%')`,
      );
      await client.query(
        `DELETE FROM allocations WHERE planned_hire_id IN (SELECT id FROM planned_hires WHERE requisition LIKE '${prefix}%')`,
      );
      await client.query(
        `DELETE FROM people WHERE preferred_name LIKE '${prefix}%'`,
      );
      await client.query(
        `DELETE FROM planned_hires WHERE requisition LIKE '${prefix}%'`,
      );
      await client.query(`DELETE FROM activities WHERE name LIKE '${prefix}%'`);
      await client.query(`DELETE FROM features WHERE name LIKE '${prefix}%'`);
      await client.query(`DELETE FROM projects WHERE name LIKE '${prefix}%'`);
      await client.query(`DELETE FROM releases WHERE name LIKE '${prefix}%'`);
      await client.query(
        `DELETE FROM release_streams WHERE name LIKE '${prefix}%'`,
      );
    });
  });

  const addProject = (client: Client, name = `${prefix} Project`) =>
    firstId(client, "INSERT INTO projects (name) VALUES ($1) RETURNING id", [
      name,
    ]);

  const addRelease = async (client: Client) => {
    const [stream] = await addStreams(client, `${prefix} Stream`);
    return firstId(
      client,
      "INSERT INTO releases (stream_id, name, first_cycle, last_cycle) VALUES ($1, $2, '2027-01-04', '2027-01-04') RETURNING id",
      [stream, `${prefix} Release`],
    );
  };

  const addActivity = (
    client: Client,
    owner: { projectId?: string | null; releaseId?: string | null },
    values: Readonly<Record<string, unknown>> = {},
  ) =>
    firstId(
      client,
      "INSERT INTO activities (project_id, release_id, name, description, note, estimate_hours) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
      [
        owner.projectId ?? null,
        owner.releaseId ?? null,
        values.name ?? `${prefix} One`,
        values.description ?? null,
        values.note ?? null,
        values.estimateHours ?? null,
      ],
    );

  const addPerson = (client: Client) =>
    firstId(
      client,
      `INSERT INTO people (preferred_name, employee_id, position_id) VALUES ($1, $2, ${aPosition}) RETURNING id`,
      [`${prefix} Person`, `${prefix}-1`],
    );

  const addFeature = (client: Client) =>
    firstId(
      client,
      `INSERT INTO features (status_id, name) VALUES (${anyFeatureStatus}, $1) RETURNING id`,
      [`${prefix} Feature`],
    );

  const allocate = (
    client: Client,
    personId: string,
    work: { featureId?: string | null; activityId?: string | null },
  ) =>
    client.query(
      "INSERT INTO allocations (person_id, feature_id, activity_id, months) VALUES ($1, $2, $3, '{}')",
      [personId, work.featureId ?? null, work.activityId ?? null],
    );

  it("lets an activity belong to a project or to a release", async () => {
    await withClient(database.app, async (client) => {
      await addActivity(client, { projectId: await addProject(client) });
      await addActivity(client, { releaseId: await addRelease(client) });
      const added = await client.query(
        `SELECT count(*)::int AS count FROM activities WHERE name LIKE '${prefix}%'`,
      );
      expect(added.rows).toEqual([{ count: 2 }]);
    });
  });

  it("refuses an activity of both a project and a release, or of neither", async () => {
    await withClient(database.app, async (client) => {
      const projectId = await addProject(client);
      const releaseId = await addRelease(client);
      expect(
        await errorCodeOf(addActivity(client, { projectId, releaseId })),
      ).toBe(checkViolation);
      expect(await errorCodeOf(addActivity(client, {}))).toBe(checkViolation);
    });
  });

  it("keeps an activity's name unique within its project, ignoring letter case", async () => {
    await withClient(database.app, async (client) => {
      const projectId = await addProject(client);
      await addActivity(client, { projectId });
      expect(
        await errorCodeOf(
          addActivity(client, { projectId }, { name: `${prefix} ONE` }),
        ),
      ).toBe(uniqueViolation);
    });
  });

  it("keeps an activity's name unique within its release, ignoring letter case", async () => {
    await withClient(database.app, async (client) => {
      const releaseId = await addRelease(client);
      await addActivity(client, { releaseId });
      expect(
        await errorCodeOf(
          addActivity(client, { releaseId }, { name: `${prefix} one` }),
        ),
      ).toBe(uniqueViolation);
    });
  });

  it("lets another project or a release have an activity of the same name", async () => {
    await withClient(database.app, async (client) => {
      await addActivity(client, { projectId: await addProject(client) });
      await addActivity(client, {
        projectId: await addProject(client, `${prefix} Project Two`),
      });
      await addActivity(client, { releaseId: await addRelease(client) });
      const added = await client.query(
        `SELECT count(*)::int AS count FROM activities WHERE name = '${prefix} One'`,
      );
      expect(added.rows).toEqual([{ count: 3 }]);
    });
  });

  it.each([
    ["an empty note", { note: "" }],
    ["an empty description", { description: "" }],
    ["a negative estimate", { estimateHours: "-1" }],
    ["an estimate that is not a number", { estimateHours: "NaN" }],
  ])("refuses %s", async (_case, values) => {
    await withClient(database.app, async (client) => {
      const projectId = await addProject(client);
      expect(
        await errorCodeOf(addActivity(client, { projectId }, values)),
      ).toBe(checkViolation);
    });
  });

  it("gives each activity a key of its own kind", async () => {
    await withClient(database.app, async (client) => {
      const id = await addActivity(client, {
        projectId: await addProject(client),
      });
      const keys = await client.query(
        "SELECT kind FROM record_keys WHERE record_id = $1",
        [id],
      );
      expect(keys.rows).toEqual([{ kind: "activity" }]);
    });
  });

  it.each(["project-activity", "release-activity"])(
    "numbers a %s drafted to be added as an activity",
    async (recordType) => {
      await withClient(database.app, async (client) => {
        const id = randomUUID();
        await client.query(
          "INSERT INTO drafts (record_type, record_id, action) VALUES ($1, $2, 'created')",
          [recordType, id],
        );
        const keys = await client.query(
          "SELECT kind FROM record_keys WHERE record_id = $1",
          [id],
        );
        await client.query("DELETE FROM drafts WHERE record_id = $1", [id]);
        expect(keys.rows).toEqual([{ kind: "activity" }]);
      });
    },
  );

  it("keeps a project or release with activities from being deleted", async () => {
    await withClient(database.app, async (client) => {
      const projectId = await addProject(client);
      const releaseId = await addRelease(client);
      await addActivity(client, { projectId });
      await addActivity(client, { releaseId });
      expect(
        await errorCodeOf(
          client.query("DELETE FROM projects WHERE id = $1", [projectId]),
        ),
      ).toBe(restrictViolation);
      expect(
        await errorCodeOf(
          client.query("DELETE FROM releases WHERE id = $1", [releaseId]),
        ),
      ).toBe(restrictViolation);
    });
  });

  it("allocates someone to an activity, once", async () => {
    await withClient(database.app, async (client) => {
      const personId = await addPerson(client);
      const activityId = await addActivity(client, {
        projectId: await addProject(client),
      });
      await allocate(client, personId, { activityId });
      expect(
        await errorCodeOf(allocate(client, personId, { activityId })),
      ).toBe(uniqueViolation);
    });
  });

  it("allocates a planned hire to an activity, once", async () => {
    await withClient(database.app, async (client) => {
      const hireId = await firstId(
        client,
        `INSERT INTO planned_hires (requisition, position_id, state_id) VALUES ($1, ${aPosition}, (SELECT i.id FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'hiring-states' AND i.meaning = 'open')) RETURNING id`,
        [`${prefix} REQ`],
      );
      const activityId = await addActivity(client, {
        projectId: await addProject(client),
      });
      const allocateHire = () =>
        client.query(
          "INSERT INTO allocations (planned_hire_id, activity_id, months) VALUES ($1, $2, '{}')",
          [hireId, activityId],
        );
      await allocateHire();
      expect(await errorCodeOf(allocateHire())).toBe(uniqueViolation);
    });
  });

  it("refuses an allocation to both a feature and an activity, or to neither", async () => {
    await withClient(database.app, async (client) => {
      const personId = await addPerson(client);
      const featureId = await addFeature(client);
      const activityId = await addActivity(client, {
        projectId: await addProject(client),
      });
      expect(
        await errorCodeOf(
          allocate(client, personId, { featureId, activityId }),
        ),
      ).toBe(checkViolation);
      expect(await errorCodeOf(allocate(client, personId, {}))).toBe(
        checkViolation,
      );
    });
  });

  it("keeps an activity with allocations from being deleted", async () => {
    await withClient(database.app, async (client) => {
      const activityId = await addActivity(client, {
        projectId: await addProject(client),
      });
      await allocate(client, await addPerson(client), { activityId });
      expect(
        await errorCodeOf(
          client.query("DELETE FROM activities WHERE id = $1", [activityId]),
        ),
      ).toBe(restrictViolation);
    });
  });
});
