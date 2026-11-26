// SPDX-License-Identifier: Apache-2.0

// Helpers for tests that talk to a test database directly: a client for one action, the code a
// statement's refusal carries, the id a statement returns, and a fictional position for people.

import { Client } from "pg";
import type { DatabaseConfig } from "./config.ts";

export const insufficientPrivilege = "42501";
// The code a trigger's RAISE EXCEPTION refuses a statement with.
export const raisedException = "P0001";

export async function withClient<T>(
  config: DatabaseConfig,
  action: (client: Client) => Promise<T>,
): Promise<T> {
  const client = new Client(config);
  await client.connect();
  try {
    return await action(client);
  } finally {
    await client.end();
  }
}

export async function errorCodeOf(
  promise: Promise<unknown>,
): Promise<string | undefined> {
  try {
    await promise;
    return undefined;
  } catch (error) {
    return (error as { code?: string }).code;
  }
}

export async function firstId(
  client: Client,
  statement: string,
  values: readonly unknown[],
): Promise<string> {
  const added = await client.query<{ id: string }>(statement, [...values]);
  return added.rows[0]?.id as string;
}

// A position every fictional person and hire is given, in the built-in Positions list, once
// addPosition has added it.
export const aPosition =
  "(SELECT id FROM list_items WHERE label = 'Fictional Position')";

export const addPosition = (client: Client) =>
  client.query(
    "INSERT INTO list_items (list_id, label) SELECT id, 'Fictional Position' FROM lists WHERE built_in = 'positions'",
  );

// Adds an open fictional planned hire with the requisition given, once addPosition has added its
// position, and gives its id.
export const addPlannedHire = (client: Client, requisition: string) =>
  firstId(
    client,
    `INSERT INTO planned_hires (requisition, position_id, state_id) VALUES ($1, ${aPosition}, (SELECT i.id FROM list_items i JOIN lists l ON l.id = i.list_id WHERE l.built_in = 'hiring-states' AND i.meaning = 'open')) RETURNING id`,
    [requisition],
  );
