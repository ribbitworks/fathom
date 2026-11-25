// SPDX-License-Identifier: Apache-2.0

// What a draft changes, field by field, and who changed each field, in words: shown at the top of
// the menu of each record with a draft, on the People table and the Lists page, so whoever approves
// or discards a draft sees what it holds, since several people's changes to one record make one
// draft.

import {
  builtInColumnNames,
  type ChangedField,
  type ChangeValue,
  type Field,
  type List,
  type Person,
  type PersonDraft,
} from "@fathom/shared";
import { Menu, Text } from "@mantine/core";
import type { ReactNode } from "react";
import { cellKinds } from "./cell-kinds.tsx";
import { describeField } from "./changes.ts";
import { nameAs } from "./names.ts";
import type { DetailKey } from "./people-grid.tsx";
import classes from "./pages.module.css";
import { type Phrase, PhraseText, phraseText } from "./phrase.tsx";
import { DraftDot } from "./status-mark.tsx";
import { type DraftLike, draftWords } from "./draft-marks.ts";

export interface DraftField {
  // The field's key, as the draft names it: a detail's name or a column's identifier.
  key: string;
  field: ChangedField;
}

// A person's reporting fields as a draft words them, live and drafted: managers by name, found
// among the people given, so a manager not among them is said to be someone not shown, never none,
// or left unnamed when no people are given.
export const notShown = "Someone not shown in People";

function reportingValues(
  key: string,
  person: Person,
  live: PersonDraft["live"],
  people: readonly Person[] | undefined,
): [ChangeValue, ChangeValue] | undefined {
  switch (key) {
    case "managerId":
      return [
        live.managerId == null || people === undefined
          ? null
          : (people.find(({ id }) => id === live.managerId)?.preferredName ??
            notShown),
        person.manager?.preferredName ?? null,
      ];
    case "managerFrom":
      return [live.managerFrom ?? null, person.managerFrom ?? null];
    case "teamName":
      return [live.teamName ?? null, person.teamName ?? null];
    default:
      return undefined;
  }
}

// What a person's draft changes, field by field, as the change history words it: each built-in
// detail and column, from its live value to the draft's. A draft adding someone does not repeat
// their name.
export function personDraftFields(
  person: Person,
  draft: PersonDraft,
  fields: readonly Field[],
  lists: readonly List[],
  // Absent where the people are not to hand, when an old manager goes unnamed.
  people?: readonly Person[],
): DraftField[] {
  return draft.changed.flatMap((key): DraftField[] => {
    // Only a planned hire's draft fills it, naming the person only to those who see them.
    if (key === "filledBy") {
      return [
        {
          key,
          field: {
            field: key,
            oldValue: null,
            newValue:
              people?.find(({ id }) => id === person.filler)?.preferredName ??
              null,
          },
        },
      ];
    }
    const reporting = reportingValues(key, person, draft.live, people);
    if (reporting !== undefined) {
      const [oldValue, newValue] = reporting;
      return [
        {
          key,
          field: {
            field: key,
            oldValue: draft.action === "created" ? null : oldValue,
            newValue,
          },
        },
      ];
    }
    if (key === "positionId" || key === "stateId") {
      const labelOf = (id: string | undefined) =>
        lists
          .flatMap(({ choices }) => choices)
          .find((choice) => choice.id === id)?.label ?? null;
      return [
        {
          key,
          field: {
            field: key,
            oldValue:
              draft.action === "created"
                ? null
                : labelOf(
                    key === "positionId"
                      ? draft.live.positionId
                      : draft.live.stateId,
                  ),
            newValue: labelOf(
              key === "positionId" ? person.positionId : person.stateId,
            ),
          },
        },
      ];
    }
    if (builtInColumnNames.has(key)) {
      if (draft.action === "created" && key === "preferredName") return [];
      const detail = key as DetailKey;
      return [
        {
          key,
          field: {
            field: key,
            // The detail is one of the fixed built-in ones.
            /* eslint-disable security/detect-object-injection */
            oldValue:
              draft.action === "created" ? null : (draft.live[detail] ?? null),
            newValue: person[detail] ?? null,
            /* eslint-enable security/detect-object-injection */
          },
        },
      ];
    }
    const field = fields.find(({ id }) => id === key);
    // A choice may come from any list, as the column's may have changed.
    const column = { choices: lists.flatMap(({ choices }) => choices) };
    const kind = cellKinds[field?.type ?? "choice"];
    // Every type of added column describes its values in a draft's details.
    const inDetail = kind.inDetail as NonNullable<typeof kind.inDetail>;
    const words = (from: PersonDraft["live"]) =>
      inDetail(column, kind.read(from, key));
    return [
      {
        key,
        field: {
          field: "value",
          ...(field === undefined ? {} : { column: field.name }),
          oldValue: words(draft.live),
          newValue: words(person),
        },
      },
    ];
  });
}

// What a list's or choice's draft changing it changes, field by field, from its live value.
export function configDraftFields(
  draft: { action: string; changed: string[]; live: object },
  now: object,
): DraftField[] {
  if (draft.action !== "changed") return [];
  const live = new Map(Object.entries(draft.live));
  const current = new Map(Object.entries(now));
  return draft.changed.map((key) => ({
    key,
    field: {
      field: key,
      oldValue: (live.get(key) ?? null) as ChangeValue,
      newValue: (current.get(key) ?? null) as ChangeValue,
    },
  }));
}

export interface Credited {
  action?: "created" | "changed" | "deleted";
  madeBy: string | null;
  madeAs?: string | null | undefined;
  editors?: (string | null)[] | undefined;
  changedBy?: Record<string, string | null> | undefined;
}

const nameOf = (name: string | null | undefined) => name ?? "Fathom";

// Who last changed a draft, with the role they acted as.
const makerOf = (draft: Credited) => nameAs(nameOf(draft.madeBy), draft.madeAs);

// Who changed a field of a draft, or, without a record of it, who last changed the draft.
export function changerOf(draft: Credited, key: string): string {
  const by = new Map(Object.entries(draft.changedBy ?? {}));
  return by.has(key) ? nameOf(by.get(key)) : makerOf(draft);
}

// A draft in lines: what it does, or each field it changes, each with who did it.
export function draftLines(
  draft: Credited,
  changed: readonly DraftField[],
): Phrase[] {
  if (draft.action === "created") {
    return [[{ strong: "Added" }, ` by ${makerOf(draft)}`]];
  }
  if (draft.action === "deleted") {
    return [[{ strong: "Removed" }, ` by ${makerOf(draft)}`]];
  }
  if (changed.length === 0) {
    return [[{ strong: "Changed" }, ` by ${makerOf(draft)}`]];
  }
  return changed.map(({ key, field }) => [
    ...(describers.get(key) ?? describeField)(field),
    `, by ${changerOf(draft, key)}`,
  ]);
}

function describeFill(field: ChangedField): Phrase {
  return field.newValue === null
    ? [{ strong: "Filled" }]
    : [{ strong: "Filled" }, " with ", { value: String(field.newValue) }];
}

// Fields a draft words in a way of their own, rather than as a change from one value to another.
const describers = new Map<string, (field: ChangedField) => Phrase>([
  ["filledBy", describeFill],
]);

// A line in a menu, such as why the item above it is turned off, which describes that item when
// given its identifier, as useTurnedOff gives it.
export function MenuNote({
  id,
  children,
}: {
  id?: string;
  children: ReactNode;
}) {
  return (
    <Text id={id} fz="xs" px="sm" pb={4} className={classes.draftLine}>
      {children}
    </Text>
  );
}

// Why a draft can't be decided by this account, or yet, as its menu and its details say it.
export const otherApproverWords = "Needs another approver";
export const waitingWords = "Waiting for a rejected draft to be resubmitted";
export const heldWords = (by: string) =>
  `Being changed by ${by}. It can be changed once they publish or discard their changes.`;
export const unpublishedWords =
  "Nobody else sees these changes until they're published.";

// Under Approve, greyed out, for a draft this account changed when its role does not let it approve
// its own.
export function OtherApproverNote() {
  return <MenuNote>{otherApproverWords}</MenuNote>;
}

// Under an Approve item that is disabled because the draft depends on a rejected one.
export function WaitingNote() {
  return <MenuNote>{waitingWords}</MenuNote>;
}

// In the menu of a record someone else has unpublished changes to, which nobody else may change,
// approve, or reject until they publish or discard them.
export function HeldNote({ by }: { by: string }) {
  return <MenuNote>{heldWords(by)}</MenuNote>;
}

// In the menu of a record whose draft holds the user's own unpublished changes, which nobody can
// approve until they publish them.
export function UnpublishedNote() {
  return <MenuNote>{unpublishedWords}</MenuNote>;
}

// The name at the top of a record's menu, set apart from what follows it.
export function MenuTitle({ children }: { children: ReactNode }) {
  return (
    <>
      <Menu.Label className={classes.menuTitle}>{children}</Menu.Label>
      <Menu.Divider />
    </>
  );
}

// A draft's section at the top of a record's menu: its mark, red once rejected, then why it was
// rejected, then its lines, such as what it changes and who changed it.
export function MenuDraftLines({
  draft,
  lines,
  divider = true,
}: {
  draft: DraftLike;
  lines: readonly Phrase[];
  // Set apart from the items after them, when there are any.
  divider?: boolean;
}) {
  return (
    <>
      <Menu.Label className={classes.draftHeading}>
        <DraftDot draft={{ ...draft, reason: undefined }} />
        {draftWords({ ...draft, reason: undefined })}
      </Menu.Label>
      {draft.state === "rejected" && draft.reason !== undefined && (
        <Text fz="xs" px="sm" pb={4} className={classes.rejectedReason}>
          Reason: {draft.reason}
        </Text>
      )}
      {lines.map((line) => (
        <Text
          key={phraseText(line)}
          fz="xs"
          px="sm"
          pb={4}
          className={classes.draftLine}
        >
          <PhraseText phrase={line} />
        </Text>
      ))}
      {divider && <Menu.Divider />}
    </>
  );
}
