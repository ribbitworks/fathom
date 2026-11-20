// SPDX-License-Identifier: Apache-2.0

// Undoing a change set's changes to drafts of people, lists, columns and the planning settings.
// Part of the data access layer.

import type { Tier } from "@fathom/shared";
import { type Actor, storedTier } from "../access.ts";
import { choicesWithAdded } from "./added-columns.ts";
import { ConflictError } from "../errors.ts";
import type { Transaction } from "./changes.ts";
import {
  drafted,
  fitsColumns,
  type Recorded,
  rejectedField,
  tidy,
} from "./draft-records.ts";
import { draftsUse, takenEmployeeIds } from "./drafted-values.ts";
import { readPersonDrafts, writeDraft, writePersonDraft } from "./drafts.ts";
import {
  checkList,
  columnRow,
  columnTier,
  mayRemoveValuesOf,
  refuseSensitiveOnFeatures,
  nameTaken,
  readColumnsState,
} from "./column-state.ts";
import { classifyDraft } from "./data-classes.ts";
import { checkValuesFit } from "./fields.ts";
import {
  choiceLabelTaken,
  choicesHaveDrafts,
  draftedList,
  listExists,
  listNameTaken,
  listOfChoice,
  readState,
  refuseIfChosen,
  refuseIfUsed,
  refuseLastKept,
  refuseUnseenList,
  writeOrderDraft,
  refuseSensitiveFeatureList,
} from "./lists.ts";
import { withMark } from "./person-fields.ts";
import { readLive } from "./people-reads.ts";
import {
  notMarked,
  readManagers,
  refuseLoop,
  refuseTakenTeamNames,
  refuseUnmarkingManagers,
} from "./reporting.ts";
import { typeOf } from "./column-types.ts";
import { type ColumnInfo, fieldOfValue } from "./values.ts";
import { stateOf, versionOf } from "./record-state.ts";
import { readRecordsState } from "./records.ts";
import { readToday } from "./settings.ts";
import {
  hireDraftsNaming,
  partOfFill,
  refuseUnmarkingHireManagers,
} from "./hire-checks.ts";
import { byKind, changedSince, type Undone } from "./undo-records.ts";

// A list of identifiers or keys as the history holds it: an order is always recorded whole.
const ids = (value: unknown): string[] => (value as unknown[]).map(String);

// A person put back in a draft from the values a change set removed, with dates left empty when it
// held none.
function fromOld(old: ReadonlyMap<string, unknown>): Recorded {
  return {
    startDate: null,
    endDate: null,
    ...Object.fromEntries([...old].filter(([, value]) => value !== null)),
  };
}

// Puts back the drafts of the people a change set changed in their drafts: the person it drafted
// adding taken out, the one it drafted removing put back as they were, and the fields it changed
// put back, with a rejection's reason. Each must still fit the columns, and keep an Employee ID no
// one else has taken since.
export async function undoPersonDrafts(
  transaction: Transaction,
  editor: string,
  columns: readonly ColumnInfo[],
  records: readonly Undone[],
  hiresUndone: readonly string[],
): Promise<void> {
  const ids = records.map(({ id }) => id);
  const today = await readToday(transaction);
  const live = await readLive(transaction, columns, {
    ids,
    lock: true,
    asOf: today,
  });
  const draftsNow = await readPersonDrafts(transaction, ids, editor);
  const undone = (id: string) =>
    new Set(records.find((record) => record.id === id)?.old.keys());
  const wanted = records.map((record) => {
    const draft = draftsNow.get(record.id);
    const old = withoutRejection(record.old);
    let person: Recorded | undefined;
    if (record.action === "deleted") {
      person = fromOld(old);
      if (person.positionId === undefined)
        throw new ConflictError(changedSince);
    } else if (record.action === "changed") {
      const now = drafted(live.get(record.id), draft);
      if (now === undefined) throw new ConflictError(changedSince);
      // Columns left with nothing chosen are left out.
      person = withMark(
        tidy({ ...now, ...Object.fromEntries(old) }),
        live.get(record.id),
      );
    }
    return { id: record.id, person };
  });
  const chosen = wanted.flatMap(({ person }) =>
    Object.entries(person ?? {}).flatMap(([field, value]) =>
      fieldOfValue(field) !== null && Array.isArray(value)
        ? value.map(String)
        : [],
    ),
  );
  const listOf = new Map(
    (await choicesWithAdded(transaction, editor, chosen)).map(
      ({ id, listId }) => [id, listId],
    ),
  );
  for (const { id, person } of wanted) {
    if (person !== undefined) {
      const taken = await takenEmployeeIds(
        transaction,
        [String(person.employeeId)],
        [id],
      );
      if (taken.length > 0 || !fitsColumns(columns, listOf, person)) {
        throw new ConflictError(changedSince);
      }
      await refuseUndoneReporting(
        transaction,
        editor,
        id,
        person,
        undone(id),
        today,
        hiresUndone,
      );
    }
    await writePersonDraft(transaction, editor, id, live.get(id), person);
  }
}

// Refuses putting back, among the fields given: a team name another team has taken since; a manager,
// line, or Manager? that a fill drafted since holds; a line to a manager no longer checked as one,
// or one that makes a loop with the drafts made since; and an unchecked Manager? while people report
// to the person.
async function refuseUndoneReporting(
  transaction: Transaction,
  editor: string,
  id: string,
  person: Recorded,
  putBack: ReadonlySet<string>,
  today: string,
  hiresUndone: readonly string[],
): Promise<void> {
  if (putBack.has("teamName") && typeof person.teamName === "string") {
    await refuseTakenTeamNames(transaction, [{ id, name: person.teamName }]);
  }
  // What a fill drafted sets on its person is kept until the fill is discarded, undone or decided.
  if (
    ["managerId", "managerFrom", "isManager"].some((field) =>
      putBack.has(field),
    ) &&
    (await hireDraftsNaming(transaction, "filledBy", [id], editor))
  ) {
    throw new ConflictError(partOfFill);
  }
  if (
    putBack.has("positionId") &&
    (await hireDraftsNaming(transaction, "filledBy", [id], editor, {
      except: hiresUndone,
    }))
  ) {
    throw new ConflictError(partOfFill);
  }
  if (
    (putBack.has("managerId") || putBack.has("managerFrom")) &&
    typeof person.managerFrom === "string"
  ) {
    if (typeof person.managerId === "string") {
      const manager = (await readManagers(transaction, [person.managerId])).get(
        person.managerId,
      );
      if (manager !== undefined && !manager.isManager) {
        throw new ConflictError(notMarked(manager));
      }
    }
    await refuseLoop(
      transaction,
      editor,
      id,
      typeof person.managerId === "string" ? person.managerId : null,
      person.managerFrom,
      today,
    );
  }
  if (putBack.has("isManager") && person.isManager !== true) {
    await refuseUnmarkingManagers(transaction, [id], today, { drafted: true });
    await refuseUnmarkingHireManagers(transaction, [id], {
      drafted: true,
      editor,
    });
  }
}

// A record's old values without the rejection a change cleared: undoing a change to a draft puts
// back the editor's unpublished draft, which is waiting once published, and the published draft
// keeps its rejection until then.
function withoutRejection(
  old: ReadonlyMap<string, unknown>,
): Map<string, unknown> {
  const kept = new Map(old);
  kept.delete(rejectedField);
  return kept;
}

// The class of a list or column only drafted to be added, put back by undoing, is checked as
// drafting it was, since the role may have changed since; it starts General unless someone with
// Classify data gives it another.
function reclassifyDraft(
  actor: Actor,
  wanted: Recorded,
  now: unknown,
  to: Tier,
): void {
  classifyDraft(actor, {
    live: false,
    name: String(wanted.name),
    from: now === undefined || now === null ? "general" : storedTier(now),
    to,
  });
}

// Puts back the drafts of the lists, choices, and choice orders a change set changed in their
// drafts, one at a time, in the order lists come before their choices: the record it drafted adding
// taken out, the one it drafted removing put back as it was, the fields it changed put back, with a
// rejection's reason, and an order as it was. Each must still have a name no one else has taken
// since, and belong to a list that is there to change.
export async function undoListDrafts(
  transaction: Transaction,
  actor: Actor,
  records: readonly Undone[],
): Promise<void> {
  const editor = actor.user.id;
  for (const record of [...records].sort((a, b) => byKind(a) - byKind(b))) {
    const state = await readState(transaction, editor);
    const old = withoutRejection(record.old);
    // A list's changes are recorded as General, so the list's own class decides who undoes them.
    refuseUnseenList(
      actor,
      state,
      record.recordType === "list-item"
        ? (listOfChoice(state, record.id) ?? String(old.get("listId")))
        : record.id,
    );
    if (record.recordType === "choice-order") {
      // Every change to a draft of an order records the whole order.
      const wanted = ids(old.get("order"));
      if (draftedList(state, record.id) === undefined) {
        throw new ConflictError(changedSince);
      }
      await writeOrderDraft(transaction, editor, state, record.id, wanted);
      continue;
    }
    const isList = record.recordType === "list";
    const recordType = isList ? "list" : "list-item";
    const live = isList
      ? state.lists.get(record.id)
      : state.choices.get(record.id)?.record;
    const draft = (isList ? state.listDrafts : state.choiceDrafts).get(
      record.id,
    );
    const now = drafted(live, draft);
    let wanted: Recorded | undefined;
    if (record.action === "deleted") {
      wanted = Object.fromEntries(
        [...old].filter(([, value]) => value !== null),
      );
    } else if (record.action === "changed") {
      // Undoing is refused once anything changes the record since, so its draft is still there.
      wanted = { ...(now as Recorded), ...Object.fromEntries(old) };
    }
    if (isList) {
      // A list drafted to be added keeps its draft while choices are drafted into it.
      if (
        wanted === undefined &&
        live === undefined &&
        [...state.choiceDrafts.values()].some(
          ({ fields }) => fields.listId === record.id,
        )
      ) {
        throw new ConflictError(changedSince);
      }
      if (
        wanted !== undefined &&
        listNameTaken(state, String(wanted.name), record.id)
      ) {
        throw new ConflictError(changedSince);
      }
      if (wanted !== undefined && live === undefined) {
        const to = storedTier(wanted.visibility);
        reclassifyDraft(actor, wanted, now?.visibility, to);
        await refuseSensitiveFeatureList(transaction, record.id, to);
      }
    } else if (wanted !== undefined) {
      // A choice always records its list.
      const listId = String(wanted.listId);
      if (
        !listExists(state, listId) ||
        draftedList(state, listId) === undefined ||
        choiceLabelTaken(state, listId, String(wanted.label), record.id)
      ) {
        throw new ConflictError(changedSince);
      }
    }
    // What drafting itself refuses: retiring, removing, or discarding a list a column draws on,
    // removing a list whose choices have drafts, and removing a choice that people have.
    if (isList && live === undefined && wanted === undefined) {
      await refuseIfUsed(transaction, record.id, "discarded", editor);
    }
    if (isList && live !== undefined) {
      if (wanted === undefined) {
        await refuseIfUsed(transaction, record.id, "deleted", editor);
        if (choicesHaveDrafts(state, record.id)) {
          throw new ConflictError(changedSince);
        }
      } else if (wanted.retired === true && now?.retired !== true) {
        await refuseIfUsed(transaction, record.id, "retired", editor);
      }
    }
    if (!isList && wanted === undefined) {
      await refuseIfChosen(transaction, record.id, editor);
    }
    if (!isList) {
      const listId = listOfChoice(state, record.id) ?? String(wanted?.listId);
      refuseLastKept(state, listId, record.id, wanted);
    }
    await writeDraft(transaction, editor, recordType, record.id, live, wanted);
  }
}

// Puts back the drafts of the columns a change set changed in their drafts, as for lists: the
// column it drafted adding taken out, the one it drafted removing put back as it was, and the
// settings it changed put back. Each must still have a name no one else has taken since, and draw
// on a list that is there.
export async function undoColumnDrafts(
  transaction: Transaction,
  actor: Actor,
  records: readonly Undone[],
): Promise<void> {
  const editor = actor.user.id;
  for (const record of records) {
    const state = await readColumnsState(transaction, editor);
    const old = withoutRejection(record.old);
    const live = state.fields.get(record.id);
    const draft = state.fieldDrafts.get(record.id);
    let wanted: Recorded | undefined;
    if (record.action === "deleted") {
      wanted = Object.fromEntries(
        [...old].filter(([, value]) => value !== null),
      );
    } else if (record.action === "changed") {
      wanted = {
        ...(drafted(live, draft) as Recorded),
        ...Object.fromEntries(old),
      };
    }
    // What drafting checks, checked again, since the data may have changed since.
    if (wanted !== undefined) {
      if (nameTaken(state, String(wanted.name), record.id, wanted.tableName)) {
        throw new ConflictError(changedSince);
      }
      refuseSensitiveOnFeatures(state, wanted);
      const { listId, visibility } = typeOf(wanted).settings(wanted);
      const before = drafted(live, draft);
      if (visibility !== null && live === undefined) {
        reclassifyDraft(
          actor,
          wanted,
          before && typeOf(before).settings(before).visibility,
          storedTier(visibility),
        );
      }
      if (listId !== null && listId !== live?.listId) {
        await checkList(
          transaction,
          state,
          listId,
          () => new ConflictError(changedSince),
        );
      }
      await checkValuesFit(
        transaction,
        columnRow(record.id, live ?? { ...wanted, required: false }),
        columnRow(record.id, wanted),
      );
    } else if (live !== undefined) {
      // Putting back a removal: the column's values go once approved, so as when drafting it, no
      // draft of a person may change it, and the actor must be able to change its values.
      const tier = columnTier(state, live);
      if (
        (await draftsUse(transaction, { column: record.id }, editor)) ||
        !mayRemoveValuesOf(actor, live, tier)
      ) {
        throw new ConflictError(changedSince);
      }
    } else if (await draftsUse(transaction, { column: record.id }, editor)) {
      // Taking out a column drafted to be added, which people's drafts give values in.
      throw new ConflictError(changedSince);
    }
    await writeDraft(transaction, editor, "field", record.id, live, wanted);
  }
}

// Puts back the draft of the planning settings a change set changed, with the settings it changed as
// they were. The settings are only ever changed, and each value was checked when drafted.
export async function undoSettingsDrafts(
  transaction: Transaction,
  editor: string,
  records: readonly Undone[],
): Promise<void> {
  const state = await readRecordsState(transaction, editor);
  for (const record of records) {
    const live = stateOf(state, "planning-settings").live.get(record.id);
    const wanted = {
      ...(versionOf(state, "planning-settings", record.id) as Recorded),
      ...Object.fromEntries(withoutRejection(record.old)),
    };
    await writeDraft(
      transaction,
      editor,
      "planning-settings",
      record.id,
      live,
      wanted,
    );
  }
}
