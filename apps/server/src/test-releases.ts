// SPDX-License-Identifier: Apache-2.0

// Shared setup for the release streams integration tests: a test app with the users they act as, a
// fixed clock, and helpers that draft, approve and read streams, patterns and releases.

import {
  dayIn,
  defaultTimeZone,
  type ReleaseStream,
  type ReleaseStreams,
} from "@fathom/shared";
import { expect, vi } from "vitest";
import {
  startTestApp,
  type TestApp,
  type TestUser,
  unique,
} from "./test-app.ts";

// The server takes today's date from the clock, so the tests fix it, to give the same days on every
// run.
vi.useFakeTimers({ toFake: ["Date"] });
vi.setSystemTime(new Date("2026-06-15T12:00:00.000Z"));

export type User = TestUser;

export let test: TestApp;
export let configurer: User;
export let planner: User;
export let viewer: User;
export let approver: User;
export let featureLead: User;

export async function startReleaseTests(): Promise<void> {
  test = await startTestApp();
  configurer = await test.signedIn("workforce-administrator");
  planner = await test.signedIn("product-manager");
  viewer = await test.signedIn("team-member");
  approver = await test.signedIn("project-manager");
  featureLead = await test.signedIn("feature-lead");
}

export async function closeReleaseTests(): Promise<void> {
  await test.close();
  vi.useRealTimers();
}

export const quarters = {
  startsOn: "2027-01-01",
  length: 3,
  unit: "months",
  naming: "{YY}.{N}",
};

export async function readStreams(cookie = configurer.cookie) {
  const response = await test.request(cookie, "GET", "/api/release-streams");
  return response.json<ReleaseStreams>();
}

export async function readStream(id: string, cookie = configurer.cookie) {
  return (await readStreams(cookie)).streams.find((stream) => stream.id === id);
}

export async function draftStream(name = unique("Fictional Stream")) {
  const response = await test.request(
    configurer.cookie,
    "POST",
    "/api/release-streams",
    { name },
  );
  expect(response.statusCode).toBe(201);
  return response.json<{ stream: ReleaseStream }>().stream;
}

export async function draftPattern(
  streamId: string,
  pattern: object = quarters,
) {
  return test.request(
    configurer.cookie,
    "POST",
    `/api/release-streams/${streamId}/patterns`,
    pattern,
  );
}

export async function draftRelease(
  streamId: string,
  release: object,
  cookie = planner.cookie,
) {
  return test.request(
    cookie,
    "POST",
    `/api/release-streams/${streamId}/releases`,
    release,
  );
}

export const decide = (asking: "approval" | "rejection", body: object) =>
  test.request(approver.cookie, "POST", `/api/drafts/${asking}`, body);

export const approveAll = async (stream: ReleaseStream) => {
  const records = [
    ...(stream.draft ? [{ type: "release-stream", id: stream.id }] : []),
    ...stream.patterns
      .filter(({ draft }) => draft !== undefined)
      .map(({ id }) => ({ type: "cycle-pattern", id })),
    ...stream.releases
      .filter(({ draft }) => draft !== undefined)
      .map(({ id }) => ({ type: "release", id })),
  ];
  const response = await decide("approval", { records });
  expect(response.statusCode).toBe(200);
};

// A live stream of quarterly cycles from 2027.
export async function liveStream(): Promise<ReleaseStream> {
  const stream = await draftStream();
  await draftPattern(stream.id);
  await approveAll((await readStream(stream.id)) as ReleaseStream);
  return (await readStream(stream.id)) as ReleaseStream;
}

export const firstHalf = { firstCycle: "2027-01-01", lastCycle: "2027-04-01" };

// Today in Fathom's time zone, which the tests leave as it starts.
export const today = () => dayIn(defaultTimeZone);

export const changeEnd = (streamId: string, endsOn: string | null) =>
  test.request(
    configurer.cookie,
    "PUT",
    `/api/release-streams/${streamId}/ends-on`,
    { endsOn },
  );
