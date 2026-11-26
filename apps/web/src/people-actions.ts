// SPDX-License-Identifier: Apache-2.0

// What People's table and details panel do to its rows: add, change, remove, discard and resubmit
// people and planned hires, and ask to decide their drafts.

import type { DecidedKind, List, Person, PersonDraft } from "@fathom/shared";
import { kept } from "./added-columns.ts";
import { type Decision, decisionFor } from "./draft-decisions.ts";
import { draftSentAgain, pendingDraft, unsavedKeyNumber } from "./drafts.ts";
import {
  createHires,
  deleteHire,
  discardHireDraft,
  hireRequest,
  resubmitHireDraft,
} from "./hires.ts";
import { withLiveValues } from "./live-records.ts";
import type { PeopleActions } from "./people-grid.tsx";
import {
  addedNames,
  isHire,
  noticeName,
  personOnly,
  type RowRequest,
} from "./people-rows.ts";
import {
  createPeople,
  deletePerson,
  discardDraft,
  resubmitDraft,
  type PeopleData,
} from "./people.ts";
import {
  changedFrom,
  type ChangesFrom,
  personUpdate,
} from "./person-change.ts";
import type { RecordSaving } from "./saving.ts";

// Someone or a planned hire being added, as the table shows them before they are saved: a draft
// adding them.
function adding(id: string, request: RowRequest): Person {
  const { values, links, notes, numbers, ...details } = request;
  return {
    id,
    keyNumber: unsavedKeyNumber,
    ...details,
    values,
    links: kept(links),
    ...(notes === undefined ? {} : { notes: kept(notes) }),
    ...(numbers === undefined ? {} : { numbers: kept(numbers) }),
    // A draft adding someone changes everything, so names nothing in particular.
    draft: pendingDraft("created", { values: {}, links: {} }),
  };
}

// A person as they are live, without their draft. A web link column the draft changes that is not
// in the live links had no link.
function asLive(person: Person, draft: PersonDraft): Person {
  const { values, links, notes, numbers, ...details } = draft.live;
  const live: Person = {
    ...person,
    ...(details as Partial<Person>),
    values: { ...person.values, ...values },
    links: withLiveValues(person.links, draft.changed, links),
    notes: withLiveValues(person.notes, draft.changed, notes),
    numbers: withLiveValues(person.numbers, draft.changed, numbers),
  };
  delete live.draft;
  return live;
}

// A person drafted to be removed, as the table shows it before it is saved.
function drafted(person: Person): Person {
  return {
    ...person,
    draft: pendingDraft("deleted", { values: {}, links: {} }),
  };
}

export function peopleRecordActions({
  changes: { save, undoable, done },
  data,
  lists,
  approves,
  onDecision,
  from,
}: {
  changes: RecordSaving<PeopleData>;
  // The people and lists as last read, which each action reads only once the page has them.
  data: PeopleData | undefined;
  lists: List[] | undefined;
  // The kinds of draft the user's role approves and rejects.
  approves: readonly DecidedKind[];
  onDecision: (decision: Decision) => void;
  from: ChangesFrom | undefined;
}): Pick<
  PeopleActions,
  "decide" | "add" | "update" | "remove" | "resubmit" | "discard"
> {
  const nameOf = (row: Person) => noticeName(row, lists as List[]);
  return {
    decide: (asking, chosen, all) => {
      // Approving names the drafts the choice uses, and rejecting those that use it.
      // Drafts are only decided once the people and lists are loaded.
      const { fields, people } = data as PeopleData;
      onDecision(
        decisionFor(
          asking,
          chosen,
          approves,
          lists as List[],
          { fields, people },
          all,
        ),
      );
    },
    add: (added, onAdded, onFailed, onRefused) => {
      save({
        next: (data) => ({
          ...data,
          people: [
            ...data.people,
            ...added.map(({ id, request }) => adding(id, request)),
          ],
        }),
        save: async () => {
          // People are added together, then planned hires together, each as one change.
          const requests = added.map(({ request }) => request);
          const people = requests.filter((request) => !isHire(request));
          const hires = requests.filter(isHire);
          const savedPeople =
            people.length === 0
              ? { ids: [], changeSetId: null }
              : await createPeople(people.map(personOnly));
          const savedHires =
            hires.length === 0
              ? { ids: [], changeSetId: null }
              : await createHires(hires.map(hireRequest));
          const ids = new Map([
            ...people.map(
              (request, index) => [request, savedPeople.ids.at(index)] as const,
            ),
            ...hires.map(
              (request, index) => [request, savedHires.ids.at(index)] as const,
            ),
          ]);
          const changeSetId = savedHires.changeSetId ?? savedPeople.changeSetId;
          onAdded(requests.map((request) => String(ids.get(request))));
          return changeSetId;
        },
        failure: `Fathom could not add ${addedNames(added.map(({ request }) => request))}. Try again in a moment.`,
        onFailed,
        onRefused,
        onSaved: undoable,
      });
    },
    update: (person, given) => {
      // From another day, a change of manager is dated from it, against the person's line today.
      // The details panel dates its changes already, which dating again leaves as they are.
      const change =
        from === undefined ? given : changedFrom(given, person.id, from);
      save({
        ...personUpdate(person, change, nameOf(person)),
        onSaved: undoable,
      });
    },
    // Removing someone live is a draft, shown in place; removing someone only drafted to be added
    // discards them, which takes them out of view.
    remove: (person) => {
      save({
        next: (data) => ({
          ...data,
          people: data.people.map((other) =>
            other.id === person.id ? drafted(other) : other,
          ),
        }),
        save: () =>
          isHire(person) ? deleteHire(person.id) : deletePerson(person.id),
        failure: `Fathom could not remove ${nameOf(person)}.`,
        onSaved: undoable,
      });
    },
    resubmit: (person) => {
      save({
        next: (data) => ({
          ...data,
          people: data.people.map((other) =>
            other.id === person.id ? draftSentAgain(other) : other,
          ),
        }),
        save: () =>
          isHire(person)
            ? resubmitHireDraft(person.id)
            : resubmitDraft(person.id),
        failure: `Fathom could not send the draft of ${nameOf(person)} for approval again.`,
        onSaved: undoable,
      });
    },
    discard: (person, draft) => {
      const gone = draft.action === "created";
      save({
        next: (data) => ({
          ...data,
          people: gone
            ? data.people.filter((other) => other.id !== person.id)
            : data.people.map((other) =>
                other.id === person.id ? asLive(other, draft) : other,
              ),
        }),
        save: () =>
          isHire(person)
            ? discardHireDraft(person.id)
            : discardDraft(person.id),
        failure: `Fathom could not discard the draft of ${nameOf(person)}.`,
        onSaved: (changeSetId, before) => {
          if (gone) {
            done(
              `Discarded the draft adding ${nameOf(person)}.`,
              changeSetId,
              before,
            );
          } else {
            undoable(changeSetId, before);
          }
        },
      });
    },
  };
}
