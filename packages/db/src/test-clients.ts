// SPDX-License-Identifier: Apache-2.0

// Helpers for the database package's tests: a client for one test, a refusal's code, a fictional
// position, and fictional streams.

import { Client } from "pg";
import type { DatabaseConfig } from "./config.ts";

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

// Adds fictional streams with the names given, and gives their ids in order.
export async function addStreams(client: Client, ...names: string[]) {
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

// A position every fictional person and hire is given, in the built-in Positions list, once
// addFictionalPosition has added it.
export const aPosition =
  "(SELECT id FROM list_items WHERE label = 'Fictional Position')";

export const addFictionalPosition = (config: DatabaseConfig) =>
  withClient(config, (client) =>
    client.query(
      "INSERT INTO list_items (list_id, label) SELECT id, 'Fictional Position' FROM lists WHERE built_in = 'positions'",
    ),
  );
