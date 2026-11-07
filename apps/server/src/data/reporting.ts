// SPDX-License-Identifier: Apache-2.0

// Reporting lines and team names, with the rules the Decisions Log sets out. Part of the data access
// layer. A person's current line and their own team's name are held as fields of the person, so
// changing them is a person's draft, approved, undone, and recorded like any other: managerId and
// managerFrom, Restricted in drafts and in the change history since they name past managers, and
// teamName, General. Approving writes the line, in force from its date until the person's next. A
// team renamed keeps its colour, which is not part of any draft, and one whose name is removed
// loses it.

import {
  type Database,
  drafts,
  inChunks,
  people,
  reportingLines,
  teams,
  unpublishedDrafts,
} from "@fathom/db";
import { and, eq, inArray, notInArray, sql } from "drizzle-orm";
import { ConflictError, BadRequestError } from "../errors.ts";
import type { Transaction } from "./changes.ts";
import {
  type Draft,
  draftedPersonValues,
  readPersonDrafts,
  type Recorded,
} from "./drafts.ts";
import { bySubject, currentRecordOn, inForceOn } from "./in-force.ts";

type Reader = Pick<Database, "select">;

export type LineRow = typeof reportingLines.$inferSelect;

export const reportingFields = [
  "managerId",
  "managerFrom",
  "teamName",
] as const;

const lineFields = new Set(["managerId", "managerFrom"]);

export const text = (value: unknown) =>
  typeof value === "string" ? value : null;

// The lines of the people given, or of everyone, by person, earliest first.
export async function readLines(
  reader: Reader,
  personIds?: readonly string[],
): Promise<Map<string, LineRow[]>> {
  const rows: LineRow[] = [];
  const read = async (chunk?: readonly string[]) => {
    rows.push(
      ...(await reader
        .select()
        .from(reportingLines)
        .where(
          chunk === undefined
            ? undefined
            : inArray(reportingLines.personId, [...chunk]),
        )),
    );
  };
  if (personIds === undefined) await read();
  else for (const chunk of inChunks([...personIds])) await read(chunk);
  return bySubject(rows, (row) => row.personId);
}

export interface Team {
  name: string;
  colour: string | null;
}

// The teams of the managers given, or every named team, by manager.
export async function readTeams(
  reader: Reader,
  managerIds?: readonly string[],
): Promise<Map<string, Team>> {
  const rows: (Team & { managerId: string })[] = [];
  const read = async (chunk?: readonly string[]) => {
    rows.push(
      ...(await reader
        .select()
        .from(teams)
        .where(
          chunk === undefined
            ? undefined
            : inArray(teams.managerId, [...chunk]),
        )),
    );
  };
  if (managerIds === undefined) await read();
  else for (const chunk of inChunks([...managerIds])) await read(chunk);
  return new Map(
    rows.map(({ managerId, name, colour }) => [managerId, { name, colour }]),
  );
}

// A person's reporting fields, as recorded: their current line, if they have one, and their own
// team's name, if it has one.
export function reportingOf(
  lines: readonly LineRow[] | undefined,
  team: Team | undefined,
  today: string,
): Recorded {
  const line = currentRecordOn(lines ?? [], today);
  return {
    ...(line === undefined
      ? {}
      : { managerId: line.managerId, managerFrom: line.fromDate }),
    ...(team === undefined ? {} : { teamName: team.name }),
  };
}

// A line as the rules see it: a manager, or none, from a date.
interface Line {
  fromDate: string;
  managerId: string | null;
}

// The line a drafted line takes the place of, if any: the current line, when the manager stays and
// only the date moves, or when the new line starts the same day. Otherwise the drafted line is
// added after it.
function replacedLine<Row extends Line>(
  lines: readonly Row[],
  managerId: string | null,
  from: string,
  today: string,
): Row | undefined {
  const current = currentRecordOn(lines, today);
  return current !== undefined &&
    (current.managerId === managerId || current.fromDate === from)
    ? current
    : undefined;
}

// A person's lines, earliest first, with a drafted line in place.
function withLine(
  lines: readonly Line[],
  managerId: string | null,
  from: string,
  today: string,
): Line[] {
  const replaced = replacedLine(lines, managerId, from, today);
  return [
    ...lines.filter((line) => line !== replaced),
    { fromDate: from, managerId },
  ].sort((a, b) => a.fromDate.localeCompare(b.fromDate));
}

// Who a person reports to, and their team, as a reader sees them: the live manager for those who
// see only General details, since a draft's manager is Restricted until approved, and, for those who
// see Restricted details, since when, and whether the manager has left. Managers are found among
// everyone shown, as drafts make them.
export function shownReporting(
  person: Recorded,
  before: Recorded | undefined,
  {
    everyone,
    live,
    restricted,
    today,
  }: {
    everyone: ReadonlyMap<string, Recorded | undefined>;
    live: ReadonlyMap<string, Recorded>;
    restricted: boolean;
    today: string;
  },
) {
  const managerId = text(restricted ? person.managerId : before?.managerId);
  const manager = managerId === null ? undefined : everyone.get(managerId);
  const managerEnd = managerId === null ? null : live.get(managerId)?.endDate;
  return {
    manager:
      managerId === null || manager === undefined
        ? null
        : { id: managerId, preferredName: String(manager.preferredName) },
    team: text(manager?.teamName),
    teamName: text(person.teamName),
    ...(restricted
      ? {
          managerFrom: text(person.managerFrom),
          ...(typeof managerEnd === "string" && managerEnd < today
            ? { managerLeft: true }
            : {}),
        }
      : {}),
  };
}

// The date a new line starts from when none is given: today, or the person's start date if it is
// later, so a new employee's first line starts when they do.
export function defaultFrom(person: Recorded, today: string): string {
  const start = text(person.startDate);
  return start !== null && start > today ? start : today;
}

// A person's reporting fields as a change asks for them: a new manager, or none, from the date given
// or the default, the current line moved to a new date, or a team named or its name removed. Naming
// the current manager again, with no date, changes nothing. A line that starts on the person's start
// date moves with it when the start is put off, so a new employee's start can be.
export function changedReporting(
  person: Recorded,
  change: {
    startDate?: string | null | undefined;
    managerId?: string | null | undefined;
    managerFrom?: string | undefined;
    teamName?: string | null | undefined;
  },
  today: string,
): Recorded {
  const fields: Recorded = {};
  const from = text(person.managerFrom);
  if (
    change.managerFrom !== undefined &&
    change.managerId === undefined &&
    from === null
  ) {
    throw new BadRequestError(
      "This person has no reporting line to move; choose their manager, or none",
    );
  }
  const newManager =
    change.managerId !== undefined &&
    change.managerId !== (text(person.managerId) ?? null);
  const start = text(person.startDate);
  const newStart = change.startDate === undefined ? start : change.startDate;
  const followsStart =
    from !== null &&
    from === start &&
    newStart !== null &&
    newStart > start &&
    change.managerFrom === undefined &&
    !newManager;
  if (newManager || change.managerFrom !== undefined || followsStart) {
    fields.managerId =
      change.managerId === undefined ? person.managerId : change.managerId;
    fields.managerFrom =
      change.managerFrom ??
      (followsStart
        ? newStart
        : defaultFrom({ ...person, startDate: newStart }, today));
  }
  if (change.teamName !== undefined) fields.teamName = change.teamName;
  return fields;
}

// Why someone cannot be named as a manager until marked as one, which takes an approval first.
export const notMarked = ({ preferredName }: { preferredName: string }) =>
  `${preferredName} is not a manager yet: check Manager? on their row and have it approved first`;

const stillReporting =
  "Manager? stays checked while anyone reports to this person, or is drafted to";

// Refuses clearing the Manager? mark of people anyone still employed reports to, by a line in force
// or yet to start. When drafting, drafts naming them as a manager, published or not, count too; on
// approval, each drafted line is checked against its manager when it is approved instead.
export async function refuseUnmarkingManagers(
  reader: Reader,
  ids: readonly string[],
  today: string,
  { drafted }: { drafted: boolean },
): Promise<void> {
  for (const chunk of inChunks([...ids])) {
    const named = await reader
      .select({ personId: reportingLines.personId })
      .from(reportingLines)
      .where(inArray(reportingLines.managerId, chunk));
    const reports = [...new Set(named.map(({ personId }) => personId))];
    const lines = await readLines(reader, reports);
    const employed = new Set<string>();
    for (const part of inChunks(reports)) {
      for (const { id } of await reader
        .select({ id: people.id })
        .from(people)
        .where(
          and(
            inArray(people.id, part),
            sql`(${people.endDate} IS NULL OR ${people.endDate} >= ${today})`,
          ),
        )) {
        employed.add(id);
      }
    }
    const reporting = [...lines].some(
      ([personId, own]) =>
        employed.has(personId) &&
        own.some(
          (line) =>
            line.managerId !== null &&
            chunk.includes(line.managerId) &&
            (line.fromDate > today || line === inForceOn(own, today)),
        ),
    );
    if (
      reporting ||
      (drafted &&
        (await draftedPersonValues(reader, "managerId", chunk, [])).length > 0)
    ) {
      throw new ConflictError(stillReporting);
    }
  }
}

// Whether a draft changes a person's line.
export const changesLine = (draft: Draft) =>
  draft.action === "created" ||
  Object.keys(draft.fields).some((field) => lineFields.has(field));

// What the rules need of a person who may be named as a manager.
export interface Manager {
  preferredName: string;
  startDate: string | null;
  endDate: string | null;
  isManager: boolean;
  // Drafted to be removed, published or not.
  removing: boolean;
}

// The live people given, as possible managers, by person.
export async function readManagers(
  reader: Reader,
  ids: readonly (string | null)[],
): Promise<Map<string, Manager>> {
  const wanted = [...new Set(ids.filter((id) => id !== null))];
  const found = new Map<string, Manager>();
  for (const chunk of inChunks(wanted)) {
    const removing = new Set<string>();
    for (const table of [drafts, unpublishedDrafts]) {
      for (const { recordId } of await reader
        .select({ recordId: table.recordId })
        .from(table)
        .where(
          and(
            eq(table.recordType, "person"),
            eq(table.action, "deleted"),
            inArray(table.recordId, chunk),
          ),
        )) {
        removing.add(recordId);
      }
    }
    for (const row of await reader
      .select({
        id: people.id,
        preferredName: people.preferredName,
        startDate: people.startDate,
        endDate: people.endDate,
        isManager: people.isManager,
      })
      .from(people)
      .where(inArray(people.id, chunk))) {
      found.set(row.id, { ...row, removing: removing.has(row.id) });
    }
  }
  return found;
}

// Refuses a line that breaks the rules: one starting before the person does, or after today except
// a new employee's first, which starts on their start date; before the line now in force, or, when
// only its date moves, not after the line before it; or to a manager who is not a live person
// marked as a manager and employed on the day it starts, or who is drafted to be removed. Checked
// when drafted and again when approved, against the live people, so a manager is never someone only
// drafted to be added.
export async function checkLine(
  reader: Reader,
  id: string,
  person: Recorded,
  lines: readonly LineRow[],
  today: string,
  known?: ReadonlyMap<string, Manager>,
): Promise<void> {
  const start = text(person.startDate);
  const from = text(person.managerFrom);
  const managerId = text(person.managerId);
  const current = currentRecordOn(lines, today);
  const unchanged =
    from === null ||
    (current !== undefined &&
      current.fromDate === from &&
      current.managerId === managerId);
  if (!unchanged && start !== null && from < start) {
    throw new BadRequestError(
      "A reporting line cannot start before the person's start date",
    );
  }
  const after = unchanged ? lines : withLine(lines, managerId, from, today);
  if (start !== null && after.some(({ fromDate }) => fromDate < start)) {
    throw new BadRequestError(
      "This person has a reporting line from before that start date",
    );
  }
  if (unchanged) return;
  if (from > today && from !== start) {
    throw new BadRequestError(
      "A reporting line starts today or earlier, or, for someone who has not started, on their start date",
    );
  }
  if (current !== undefined) {
    if (managerId !== current.managerId && from < current.fromDate) {
      throw new BadRequestError(
        `A new reporting line cannot start before the current one, from ${current.fromDate}`,
      );
    }
    const before = lines[lines.indexOf(current) - 1];
    if (
      managerId === current.managerId &&
      before !== undefined &&
      from <= before.fromDate
    ) {
      throw new BadRequestError(
        `This reporting line must start after the one before it, from ${before.fromDate}`,
      );
    }
  }
  if (managerId === null) return;
  if (managerId === id) {
    throw new BadRequestError("Nobody can report to themselves");
  }
  const manager = (known ?? (await readManagers(reader, [managerId]))).get(
    managerId,
  );
  if (manager === undefined) {
    throw new BadRequestError(
      "Choose a manager from People who has been approved",
    );
  }
  if (manager.removing) {
    throw new BadRequestError(
      `${manager.preferredName} is drafted to be removed, so cannot be anyone's manager`,
    );
  }
  if (!manager.isManager) throw new BadRequestError(notMarked(manager));
  if (
    (manager.startDate !== null && manager.startDate > from) ||
    (manager.endDate !== null && manager.endDate < from)
  ) {
    throw new BadRequestError(
      `${manager.preferredName} is not employed on ${from}`,
    );
  }
}

// Each person's lines as drafts make them for the editor given: published drafts, with the editor's
// unpublished ones in their place. People drafted to be removed have none.
async function linesSeen(
  reader: Reader,
  today: string,
  editor: string,
): Promise<Map<string, Line[]>> {
  const all = new Map<string, Line[]>(await readLines(reader));
  for (const [personId, draft] of await readPersonDrafts(
    reader,
    undefined,
    editor,
  )) {
    const from = text(draft.fields.managerFrom);
    if (draft.action === "deleted") all.delete(personId);
    else if (from !== null) {
      const own = all.get(personId) ?? [];
      // A draft that moves only a line's date moves a line the person has.
      const managerId =
        "managerId" in draft.fields
          ? text(draft.fields.managerId)
          : (currentRecordOn(own, today) as Line).managerId;
      all.set(personId, withLine(own, managerId, from, today));
    }
  }
  return all;
}

// Whether following managers up from someone given leads back to them, on any day from the date
// given that a line starts, so a loop in the past, which capacity by manager counts, is refused too.
function loopsFrom(
  lines: ReadonlyMap<string, readonly Line[]>,
  ids: readonly string[],
  from: string,
): boolean {
  const days = new Set([from]);
  for (const own of lines.values()) {
    for (const { fromDate } of own) if (fromDate > from) days.add(fromDate);
  }
  return [...days].some((day) => {
    const managers = new Map(
      [...lines].map(([personId, own]) => [
        personId,
        inForceOn(own, day)?.managerId ?? null,
      ]),
    );
    return ids.some((id) => {
      const seen = new Set<string>();
      for (
        let at = managers.get(id) ?? null;
        at !== null && !seen.has(at);
        at = managers.get(at) ?? null
      ) {
        if (at === id) return true;
        seen.add(at);
      }
      return false;
    });
  });
}

// The first day a drafted line changes who the person reports to: its own date, or, when it moves
// the line in force later, that line's date, from which the line before it is back in force.
function earlier(
  lines: readonly Line[],
  managerId: string | null,
  from: string,
  today: string,
): string {
  const replaced = replacedLine(lines, managerId, from, today);
  return replaced !== undefined && replaced.fromDate < from
    ? replaced.fromDate
    : from;
}

const loopMessage =
  "That manager reports to this person, directly or through others";

// Refuses a manager who reports to the person, directly or through others, on the day the line
// starts or after, counting every draft as the editor sees them, with the person's own wanted line
// in place of their draft.
export async function refuseLoop(
  reader: Reader,
  editor: string,
  id: string,
  managerId: string | null,
  from: string,
  today: string,
): Promise<void> {
  const lines = await linesSeen(reader, today, editor);
  const own = (await readLines(reader, [id])).get(id) ?? [];
  lines.set(id, withLine(own, managerId, from, today));
  if (loopsFrom(lines, [id], earlier(own, managerId, from, today))) {
    throw new BadRequestError(loopMessage);
  }
}

// Refuses approving lines that, now applied, make anyone report to themselves on any day from the
// earliest of them.
export async function refuseLoopsLive(
  reader: Reader,
  changed: readonly { id: string; from: string }[],
): Promise<void> {
  const [earliest] = changed.map(({ from }) => from).sort();
  if (earliest === undefined) return;
  const lines = await readLines(reader);
  if (
    loopsFrom(
      lines,
      changed.map(({ id }) => id),
      earliest,
    )
  ) {
    throw new ConflictError(loopMessage);
  }
}

// Refuses team names that another manager's team has, ignoring letter case, live or in a draft,
// published or not, as Employee IDs are, or that two of the people given share.
export async function refuseTakenTeamNames(
  reader: Reader,
  named: readonly { id: string; name: string }[],
): Promise<void> {
  const lowered = named.map(({ name }) => name.toLowerCase());
  const ids = named.map(({ id }) => id);
  let taken = new Set(lowered).size !== lowered.length;
  for (const chunk of inChunks(lowered)) {
    if (taken) break;
    const live = await reader
      .select({ value: teams.name })
      .from(teams)
      .where(
        and(
          inArray(sql`lower(${teams.name})`, chunk),
          notInArray(teams.managerId, ids),
        ),
      );
    const drafted = await draftedPersonValues(reader, "teamName", chunk, ids);
    taken = live.length > 0 || drafted.length > 0;
  }
  if (taken) throw new ConflictError("Another team already has that name");
}

// Refuses removing people who are, or were, anyone's manager, live or in anyone's draft, published
// or not, since past lines are kept. Checked when drafted and again when approved.
export async function refuseRemovingManagers(
  reader: Reader,
  ids: readonly string[],
): Promise<void> {
  for (const chunk of inChunks([...ids])) {
    const named = await reader
      .select({ one: sql`1` })
      .from(reportingLines)
      .where(inArray(reportingLines.managerId, chunk))
      .limit(1);
    const drafted = await draftedPersonValues(reader, "managerId", chunk, []);
    if (named.length > 0 || drafted.length > 0) {
      throw new ConflictError(
        "People report, have reported, or are drafted to report to this person, so they cannot be removed",
      );
    }
  }
}

// Refuses dates for people that leave a line naming them as manager starting before they start or
// after they leave. When drafting, the lines are as the editor's drafts leave them, published or
// not, so a manager and their reports can be put off together; on approval, they are the live lines,
// since each drafted line is checked against its manager when it is approved. A manager who leaves
// while people still report to them is only warned about.
export async function refuseReportsOutside(
  reader: Reader,
  changed: readonly { id: string; person: Recorded }[],
  today: string,
  { editor }: { editor?: string | undefined } = {},
): Promise<void> {
  const dated = changed.filter(
    ({ person }) =>
      text(person.startDate) !== null || text(person.endDate) !== null,
  );
  if (dated.length === 0) return;
  const lines =
    editor === undefined
      ? await readLines(reader)
      : await linesSeen(reader, today, editor);
  const froms = new Map<string, string[]>();
  for (const own of lines.values()) {
    for (const { managerId, fromDate } of own) {
      if (managerId !== null) {
        froms.set(managerId, [...(froms.get(managerId) ?? []), fromDate]);
      }
    }
  }
  const who =
    editor === undefined
      ? "People report"
      : "People report, or are drafted to report,";
  for (const { id, person } of dated) {
    const start = text(person.startDate);
    const end = text(person.endDate);
    const named = froms.get(id) ?? [];
    if (start !== null && named.some((from) => from < start)) {
      throw new BadRequestError(
        `${who} to this person from before that start date`,
      );
    }
    if (end !== null && named.some((from) => from > end)) {
      throw new BadRequestError(
        `${who} to this person from after that end date`,
      );
    }
  }
}

// Writes the lines and team names that approved drafts give people, after the people themselves
// are added: a line for a new manager, or a new date for the line in force, and each team name set
// or removed. Each line, and each change to a manager's dates, is checked again against the data as
// it is now.
export async function applyReporting(
  transaction: Transaction,
  wanted: ReadonlyMap<string, { draft: Draft; person: Recorded | undefined }>,
  today: string,
): Promise<void> {
  const changed = [...wanted].filter(
    ([, { draft, person }]) => person !== undefined && changesLine(draft),
  );
  const lines = await readLines(
    transaction,
    changed.map(([id]) => id),
  );
  const managers = await readManagers(
    transaction,
    changed.map(([, { person }]) => text((person as Recorded).managerId)),
  );
  const moved: { id: string; from: string }[] = [];
  const added: {
    personId: string;
    managerId: string | null;
    fromDate: string;
  }[] = [];
  for (const [id, { person }] of changed) {
    const recorded = person as Recorded;
    const from = text(recorded.managerFrom);
    if (from === null) continue;
    const managerId = text(recorded.managerId);
    const own = lines.get(id) ?? [];
    await checkLine(transaction, id, recorded, own, today, managers);
    const replaced = replacedLine(own, managerId, from, today);
    moved.push({ id, from: earlier(own, managerId, from, today) });
    if (replaced === undefined) {
      added.push({ personId: id, managerId, fromDate: from });
    } else {
      await transaction
        .update(reportingLines)
        .set({ managerId, fromDate: from })
        .where(eq(reportingLines.id, replaced.id));
    }
  }
  for (const chunk of inChunks(added)) {
    await transaction.insert(reportingLines).values(chunk);
  }
  await refuseReportsOutside(
    transaction,
    [...wanted].flatMap(([id, { draft, person }]) =>
      person !== undefined &&
      draft.action === "changed" &&
      ("startDate" in draft.fields || "endDate" in draft.fields)
        ? [{ id, person }]
        : [],
    ),
    today,
  );
  const named = [...wanted].flatMap(([id, { draft, person }]) =>
    person !== undefined &&
    (draft.action === "created" || "teamName" in draft.fields)
      ? [{ managerId: id, name: text(person.teamName) }]
      : [],
  );
  const colours = new Map<string, string | null>();
  for (const chunk of inChunks(named.map(({ managerId }) => managerId))) {
    for (const { managerId, colour } of await transaction
      .delete(teams)
      .where(inArray(teams.managerId, chunk))
      .returning({ managerId: teams.managerId, colour: teams.colour })) {
      colours.set(managerId, colour);
    }
  }
  for (const chunk of inChunks(
    named.flatMap(({ managerId, name }) =>
      name === null
        ? []
        : [{ managerId, name, colour: colours.get(managerId) ?? null }],
    ),
  )) {
    await transaction.insert(teams).values(chunk);
  }
  await refuseLoopsLive(transaction, moved);
}
