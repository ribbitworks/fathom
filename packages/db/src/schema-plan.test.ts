// SPDX-License-Identifier: Apache-2.0

// Tests of the plan against a real PostgreSQL server: release streams, their patterns and releases,
// and features with their targets, estimates and milestones.

import type { Client } from "pg";
import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { startTestDatabase, type TestDatabase } from "@fathom/test-utils";
import { databaseCodes } from "./errors.ts";
import { errorCodeOf, firstId, withClient } from "./test-clients.ts";

let database: TestDatabase;

beforeAll(async () => {
  database = await startTestDatabase();
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
  const anyFeatureStatus =
    "(SELECT i.id FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'feature-statuses' LIMIT 1)";

  afterEach(async () => {
    await withClient(database.app, async (client) => {
      await client.query(`DELETE FROM milestones WHERE name LIKE '${prefix}%'`);
      await client.query(
        `DELETE FROM features WHERE name LIKE '${prefix}%' OR general_for_project_id IN (SELECT id FROM projects WHERE name LIKE '${prefix}%')`,
      );
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

  const addGeneralFeature = (
    client: Client,
    projectId: string,
    name: string | null = null,
  ) =>
    client.query(
      `INSERT INTO features (status_id, name, general_for_project_id) VALUES (${anyFeatureStatus}, $1, $2)`,
      [name, projectId],
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
        `SELECT needed_by, customer_ids, note, target_stream_id, target_cycle, estimate_hours, feature_team_id, description, general_for_project_id FROM features WHERE name = '${prefix} One'`,
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
          general_for_project_id: null,
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

  it("lets several projects' general features go without a name", async () => {
    await withClient(database.app, async (client) => {
      await addGeneralFeature(client, await addProject(client));
      await addGeneralFeature(
        client,
        await addProject(client, `${prefix} Project Two`),
      );
      const general = await client.query(
        `SELECT name FROM features WHERE general_for_project_id IN (SELECT id FROM projects WHERE name LIKE '${prefix}%')`,
      );
      expect(general.rows).toEqual([{ name: null }, { name: null }]);
    });
  });

  it("gives a project at most one general feature", async () => {
    await withClient(database.app, async (client) => {
      const projectId = await addProject(client);
      await addGeneralFeature(client, projectId);
      expect(await errorCodeOf(addGeneralFeature(client, projectId))).toBe(
        uniqueViolation,
      );
    });
  });

  it("refuses a general feature with a name of its own", async () => {
    await withClient(database.app, async (client) => {
      const projectId = await addProject(client);
      expect(
        await errorCodeOf(
          addGeneralFeature(client, projectId, `${prefix} Named General`),
        ),
      ).toBe(checkViolation);
    });
  });

  it("refuses a feature with no name that is no project's general feature", async () => {
    await withClient(database.app, async (client) => {
      expect(await errorCodeOf(addFeature(client, null))).toBe(checkViolation);
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

  it("keeps a project with a general feature from being deleted", async () => {
    await withClient(database.app, async (client) => {
      const projectId = await addProject(client);
      await addGeneralFeature(client, projectId);
      expect(await errorCodeOf(removeRow(client, "projects", projectId))).toBe(
        restrictViolation,
      );
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
