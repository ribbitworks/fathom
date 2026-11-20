// SPDX-License-Identifier: Apache-2.0

// Filling planned hires: one draft spread over the hire, the person who fills it, and the hires
// that report to it. Part of the data access layer.

import { refuseFillingAllocated } from "./allocations.ts";
import { type Database, plannedHires } from "@fathom/db";
import {
  approvesKind,
  type DraftsRequest,
  type HireFill,
  seesEmployment,
} from "@fathom/shared";
import { eq } from "drizzle-orm";
import {
  type Actor,
  requirePermission,
  requireSensitivityEdit,
} from "../access.ts";
import { ConflictError, ForbiddenError, NotFoundError } from "../errors.ts";
import { columnsWithAdded } from "./added-columns.ts";
import { type Change, recordChanges, type Transaction } from "./changes.ts";
import {
  drafted,
  lockDrafts,
  type Draft,
  readHeld,
  readPersonDrafts,
  type Recorded,
  type Viewer,
} from "./drafts.ts";
import { recordHiringChanges } from "./hire-fields.ts";
import { readHireDrafts, readLiveHires } from "./hire-reads.ts";
import {
  checkFillManager,
  editsHires,
  requirePersonManager,
  hireDraftsNaming,
} from "./hire-checks.ts";
import {
  discardHireDraftIn,
  draftHireAsLive,
  draftHireFilled,
  draftReportsMoved,
  fillableHire,
  resubmitHireDraftIn,
} from "./hires.ts";
import {
  discardPersonDraftIn,
  draftNewPeople,
  draftPersonAsLive,
  draftPersonChange,
  resubmitPersonDraftIn,
} from "./people.ts";
import {
  linksOf,
  noPerson,
  notesOf,
  numbersOf,
  recordSensitiveChanges,
  valuesOf,
} from "./person-fields.ts";
import { notStarted, currentOn, readLive } from "./people-reads.ts";
import { readToday } from "./settings.ts";

// The drafts of one fill: the hire filled, its person when the fill drafts them, with the fields it
// drafts on someone already in Fathom, and the hires moved to them from a planned manager.
export interface Fill {
  hireId: string;
  personId: string;
  people: string[];
  personFields: string[];
  plannedHires: string[];
}

type Reader = Pick<Database, "select">;

// The fills in drafts, as the viewer's drafts make them, or as published when there is no viewer:
// each hire drafted as filled, its person's draft, and the hires drafted to report to the person
// while they report to the hire live, which only its fill moves, since a hire only drafted to be
// added cannot be moved by one.
export async function readFills(
  reader: Reader,
  viewer?: Viewer,
): Promise<Fill[]> {
  const hireDrafts = await readHireDrafts(reader, undefined, viewer);
  const live = await readLiveHires(reader, [...hireDrafts.keys()]);
  const now = [...hireDrafts].map(([id, draft]) => ({
    id,
    hire: drafted(live.get(id), draft),
  }));
  const filling = now.flatMap(({ id, hire }) =>
    typeof hire?.filledBy === "string" &&
    live.get(id)?.filledBy !== hire.filledBy
      ? [{ hireId: id, personId: hire.filledBy, hire }]
      : [],
  );
  if (filling.length === 0) return [];
  const personDrafts = await readPersonDrafts(
    reader,
    filling.map(({ personId }) => personId),
    viewer,
  );
  return filling.map(({ hireId, personId, hire }) => {
    const draft = personDrafts.get(personId);
    const personFields = draft === undefined ? [] : fillFields(draft, hire);
    return {
      hireId,
      personId,
      people:
        draft?.action === "created" || personFields.length > 0
          ? [personId]
          : [],
      personFields,
      plannedHires: [
        hireId,
        ...now.flatMap(({ id, hire: report }) =>
          report?.managerId === personId && live.get(id)?.managerId === hireId
            ? [id]
            : [],
        ),
      ],
    };
  });
}

// The fields of someone already in Fathom that a fill of the hire drafts, as their draft holds
// them: the hire's position, its manager, with the line's date, and Manager? for a planned manager.
// Filling is refused while they have a draft of their own, so these are the fill's.
function fillFields(draft: Draft, hire: Recorded): string[] {
  if (draft.action !== "changed") return [];
  return [
    ...(draft.fields.positionId === hire.positionId ? ["positionId"] : []),
    ...(typeof hire.managerId === "string" &&
    draft.fields.managerId === hire.managerId
      ? ["managerId", "managerFrom"]
      : []),
    ...(hire.isManager === true && draft.fields.isManager === true
      ? ["isManager"]
      : []),
  ];
}

const inFill = (
  fill: Fill,
  asked: { people: readonly string[]; plannedHires: readonly string[] },
) =>
  fill.people.some((id) => asked.people.includes(id)) ||
  fill.plannedHires.some((id) => asked.plannedHires.includes(id));

// The drafts asked for, with every published draft of the fills any of them belong to. A fill's
// person, with a start date or a reporting line in their draft, is decided only by those who see
// Personal data.
export async function withFills(
  reader: Reader,
  actor: Actor,
  asked: DraftsRequest,
): Promise<DraftsRequest> {
  const people = new Set(asked.people);
  const hires = new Set(asked.plannedHires);
  for (const fill of await readFills(reader)) {
    if (!inFill(fill, asked)) continue;
    if (fill.people.length > 0 && !seesEmployment(actor)) {
      throw new ForbiddenError(
        "A fill names who fills the hire, so an Approver who sees start and end dates must decide it",
      );
    }
    if (
      (fill.people.length > 0 && !approvesKind(actor.permissions, "person")) ||
      !approvesKind(actor.permissions, "planned-hire")
    ) {
      throw new ForbiddenError(
        "This draft is part of filling a planned hire, which this role can't decide",
      );
    }
    for (const id of fill.people) people.add(id);
    for (const id of fill.plannedHires) hires.add(id);
  }
  return { ...asked, people: [...people], plannedHires: [...hires] };
}

// Whether any hire's draft, published or not, by anyone, fills it with the person given.
const inAnyFill = (reader: Reader, personId: string) =>
  hireDraftsNaming(reader, "filledBy", [personId]);

// The person asked to fill a hire, as the actor's drafts make them, refusing someone with a draft of
// their own, so the fill's draft of them holds only the fill, someone who has left, and someone who
// fills another hire, in anyone's draft, or live without having started. With no draft, they are as
// they are live. An actor who does not see Personal details has someone not started answered as
// no one, as People hides them.
async function fillingPerson(
  transaction: Transaction,
  actor: Actor,
  personId: string,
  today: string,
): Promise<Recorded> {
  const columns = await columnsWithAdded(transaction, actor.user.id, true);
  const live = (
    await readLive(transaction, columns, { ids: [personId], asOf: today })
  ).get(personId);
  const draft = (
    await readPersonDrafts(transaction, [personId], actor.user.id)
  ).get(personId);
  if (
    live === undefined ||
    (!seesEmployment(actor) && !currentOn(live, today))
  ) {
    throw new NotFoundError(noPerson);
  }
  const name = String(live.preferredName);
  const [held] = (
    await readHeld(transaction, "person", actor.user.id, [personId])
  ).values();
  if (draft !== undefined || held !== undefined) {
    throw new ConflictError(
      `${name} has a draft; approve or discard it before they fill a planned hire`,
    );
  }
  if (typeof live.endDate === "string" && live.endDate < today) {
    throw new ConflictError(`${name} has left, so can't fill a planned hire`);
  }
  if (await inAnyFill(transaction, personId)) {
    throw new ConflictError(
      `${name} is already filling a planned hire in a draft`,
    );
  }
  if (notStarted(live, today)) {
    const [filled] = await transaction
      .select({ id: plannedHires.id })
      .from(plannedHires)
      .where(eq(plannedHires.filledBy, personId))
      .limit(1);
    if (filled !== undefined) {
      throw new ConflictError(
        `${name} is already filling a planned hire and hasn't started it yet`,
      );
    }
  }
  return live;
}

// Drafts filling a planned hire, as one change, and returns the change set it was saved in.
export async function fillHire(
  database: Database,
  actor: Actor,
  hireId: string,
  fill: HireFill,
  asOf?: string,
): Promise<string | null> {
  requirePermission(actor, "people:edit");
  requireSensitivityEdit(actor, "hiring-plan");
  const today = asOf ?? (await readToday(database));
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const { before, hire } = await fillableHire(transaction, actor, hireId);
    await refuseFillingAllocated(transaction, hireId);
    // Someone already in Fathom given no manager keeps the one they have; a new person needs one.
    const keepsOwn = fill.managerId === null && fill.by === "existing person";
    if (
      typeof hire.managerId === "string" &&
      typeof fill.managerId !== "string" &&
      !keepsOwn
    ) {
      await requirePersonManager(transaction, hire.managerId);
    }
    if (typeof fill.managerId === "string") {
      await checkFillManager(transaction, fill.managerId, actor.user.id);
    }
    const hireManager =
      typeof hire.managerId === "string" ? hire.managerId : null;
    const managerId =
      fill.managerId === undefined ? hireManager : fill.managerId;
    const plannedManager = hire.isManager === true;
    const made: Change[] = [];
    let personId: string;
    if (fill.by === "new person") {
      const added = await draftNewPeople(
        transaction,
        actor,
        [
          {
            preferredName: fill.preferredName,
            employeeId: fill.employeeId,
            positionId: String(hire.positionId),
            startDate: fill.startDate,
            managerId,
            isManager: plannedManager,
            values: { ...fill.values, ...Object.fromEntries(valuesOf(hire)) },
            links: { ...fill.links, ...linksOf(hire) },
            notes: { ...fill.notes, ...notesOf(hire) },
            numbers: { ...fill.numbers, ...numbersOf(hire) },
          },
        ],
        today,
      );
      personId = String(added.ids[0]);
      made.push(...added.made);
    } else {
      personId = fill.personId;
      const person = await fillingPerson(transaction, actor, personId, today);
      // A transfer already reporting to the hire's manager keeps the line they have.
      const moves = managerId !== null && person.managerId !== managerId;
      made.push(
        ...(await draftPersonChange(
          transaction,
          actor,
          personId,
          {
            ...(moves
              ? {
                  managerId,
                  ...(fill.managerFrom === undefined
                    ? {}
                    : { managerFrom: fill.managerFrom }),
                }
              : {}),
            ...(hire.positionId === person.positionId
              ? {}
              : { positionId: String(hire.positionId) }),
            ...(plannedManager ? { isManager: true } : {}),
          },
          today,
        )),
      );
    }
    made.push(
      ...(await draftHireFilled(
        transaction,
        actor,
        { id: hireId, before, hire, managerId: fill.managerId },
        personId,
      )),
    );
    if (plannedManager) {
      made.push(
        ...(await draftReportsMoved(transaction, actor, hireId, personId)),
      );
    }
    await recordSensitiveChanges(transaction, actor.user.id, made);
    await recordHiringChanges(transaction, actor.user.id, made);
    return recordChanges(transaction, actor, made);
  });
}

type Asked = { kind: "person" | "planned-hire"; id: string };

// The fill the draft asked for belongs to, as the actor's drafts make it, if any.
async function fillOf(
  transaction: Transaction,
  actor: Actor,
  { kind, id }: Asked,
): Promise<Fill | undefined> {
  const asked =
    kind === "person"
      ? { people: [id], plannedHires: [] }
      : { people: [], plannedHires: [id] };
  return (await readFills(transaction, actor.user.id)).find((one) =>
    inFill(one, asked),
  );
}

// Refuses changing a fill to a role that may not change both people and the hiring plan, naming
// the fill, rather than whichever of its records comes first.
function requireFillRights(actor: Actor): void {
  if (!editsHires(actor)) {
    throw new ForbiddenError(
      "This draft is part of filling a planned hire, which this role can't change",
    );
  }
}

// Refuses changing a fill any of whose records someone other than the actor holds.
async function refuseHeldFill(
  transaction: Transaction,
  actor: Actor,
  fill: Fill,
): Promise<void> {
  const [held] = [
    ...(
      await readHeld(transaction, "person", actor.user.id, fill.people)
    ).values(),
    ...(
      await readHeld(
        transaction,
        "planned-hire",
        actor.user.id,
        fill.plannedHires,
      )
    ).values(),
  ];
  if (held !== undefined) {
    throw new ConflictError(
      `${held.holder} is changing part of this fill of a planned hire; it can be changed once they publish or discard their changes`,
    );
  }
}

const discardIn = (transaction: Transaction, actor: Actor, asked: Asked) =>
  asked.kind === "person"
    ? discardPersonDraftIn(transaction, actor, asked.id)
    : discardHireDraftIn(transaction, actor, asked.id);

// Discards the draft asked for, and takes its fill, if any, out of the drafts of the fill's other
// records, keeping their other changes: the hire's filler and manager, its person's position, manager, Manager? and line,
// and the hires moved to them, put back as they are live. A person only drafted to be added by the
// fill is discarded with it.
async function discardWithFill(
  transaction: Transaction,
  actor: Actor,
  asked: Asked,
): Promise<Change[]> {
  const fill = await fillOf(transaction, actor, asked);
  if (fill === undefined) return discardIn(transaction, actor, asked);
  requireFillRights(actor);
  await refuseHeldFill(transaction, actor, fill);
  const others = (kind: Asked["kind"], ids: readonly string[]) =>
    ids.filter((id) => !(asked.kind === kind && asked.id === id));
  const made = await discardIn(transaction, actor, asked);
  for (const id of others("planned-hire", fill.plannedHires)) {
    made.push(
      ...(await draftHireAsLive(
        transaction,
        actor,
        id,
        id === fill.hireId ? ["filledBy", "managerId"] : ["managerId"],
      )),
    );
  }
  const personDrafts = await readPersonDrafts(
    transaction,
    fill.people,
    actor.user.id,
  );
  for (const id of others("person", fill.people)) {
    made.push(
      ...(personDrafts.get(id)?.action === "created"
        ? await discardPersonDraftIn(transaction, actor, id)
        : await draftPersonAsLive(transaction, actor, id, fill.personFields)),
    );
  }
  return made;
}

// Sends the rejected draft asked for for approval again, with the drafts of the rest of its fill,
// if any, that are still rejected, since one changed since has been sent again.
async function resubmitWithFill(
  transaction: Transaction,
  actor: Actor,
  asked: Asked,
): Promise<Change[]> {
  const fill = await fillOf(transaction, actor, asked);
  const records = fill ?? {
    people: asked.kind === "person" ? [asked.id] : [],
    plannedHires: asked.kind === "planned-hire" ? [asked.id] : [],
  };
  if (fill !== undefined) {
    requireFillRights(actor);
    await refuseHeldFill(transaction, actor, fill);
  }
  const hireDrafts = await readHireDrafts(
    transaction,
    records.plannedHires,
    actor.user.id,
  );
  const personDrafts = await readPersonDrafts(
    transaction,
    records.people,
    actor.user.id,
  );
  const due = (kind: Asked["kind"], found: typeof hireDrafts) => (id: string) =>
    (asked.kind === kind && asked.id === id) ||
    found.get(id)?.state === "rejected";
  const made: Change[] = [];
  for (const id of records.plannedHires.filter(
    due("planned-hire", hireDrafts),
  )) {
    made.push(...(await resubmitHireDraftIn(transaction, actor, id)));
  }
  for (const id of records.people.filter(due("person", personDrafts))) {
    made.push(...(await resubmitPersonDraftIn(transaction, actor, id)));
  }
  return made;
}

// Does one of the two to the draft asked for, in one change, recorded as given.
async function inOneChange(
  database: Database,
  actor: Actor,
  asked: Asked,
  how: "discard" | "resubmission",
): Promise<string | null> {
  return database.transaction(async (transaction) => {
    await lockDrafts(transaction);
    const made = await (how === "discard" ? discardWithFill : resubmitWithFill)(
      transaction,
      actor,
      asked,
    );
    await recordSensitiveChanges(transaction, actor.user.id, made);
    await recordHiringChanges(transaction, actor.user.id, made);
    return recordChanges(transaction, actor, made, how);
  });
}

// Discards the draft of the person or planned hire asked for, and, when it is part of a fill, takes
// the fill out of the rest of its records' drafts.
export const discardDraft = (database: Database, actor: Actor, asked: Asked) =>
  inOneChange(database, actor, asked, "discard");

// Sends the rejected draft of the person or planned hire asked for for approval again, and, when it
// is part of a fill, the rest of the fill with it.
export const resubmitDraft = (database: Database, actor: Actor, asked: Asked) =>
  inOneChange(database, actor, asked, "resubmission");
