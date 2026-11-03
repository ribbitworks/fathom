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
import { describeField } from "./changes.ts";
import type { DetailKey } from "./people-grid.tsx";
import classes from "./pages.module.css";
import { type Phrase, PhraseText, phraseText } from "./phrase.tsx";
import { type DraftLike, DraftMark } from "./status-mark.tsx";

export interface DraftField {
  // The field's key, as the draft names it: a detail's name or a column's identifier.
  key: string;
  field: ChangedField;
}

// What a person's draft changes, field by field, as the change history words it: each built-in
// detail and column, from its live value to the draft's. A draft adding someone does not repeat
// their name.
export function personDraftFields(
  person: Person,
  draft: PersonDraft,
  fields: readonly Field[],
  lists: readonly List[],
): DraftField[] {
  const labels = (ids: readonly string[] | undefined): ChangeValue =>
    (ids ?? []).flatMap((id) => {
      const label = lists
        .flatMap(({ choices }) => choices)
        .find((choice) => choice.id === id)?.label;
      return label === undefined ? [] : [label];
    });
  const live = new Map(Object.entries(draft.live.values));
  const now = new Map(Object.entries(person.values));
  return draft.changed.flatMap((key): DraftField[] => {
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
    const column = fields.find(({ id }) => id === key);
    return [
      {
        key,
        field: {
          field: "value",
          ...(column === undefined ? {} : { column: column.name }),
          oldValue: labels(live.get(key)),
          newValue: labels(now.get(key)),
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
  editors?: (string | null)[] | undefined;
  changedBy?: Record<string, string | null> | undefined;
}

const nameOf = (name: string | null | undefined) => name ?? "Fathom";

// Who changed a field of a draft, or, without a record of it, who last changed the draft.
export function changerOf(draft: Credited, key: string): string {
  const by = new Map(Object.entries(draft.changedBy ?? {}));
  return nameOf(by.has(key) ? by.get(key) : draft.madeBy);
}

// A draft in lines: what it does, or each field it changes, each with who did it.
export function draftLines(
  draft: Credited,
  changed: readonly DraftField[],
): Phrase[] {
  if (draft.action === "created") {
    return [[{ strong: "Added" }, ` by ${nameOf(draft.madeBy)}`]];
  }
  if (draft.action === "deleted") {
    return [[{ strong: "Removed" }, ` by ${nameOf(draft.madeBy)}`]];
  }
  if (changed.length === 0) {
    return [[{ strong: "Changed" }, ` by ${nameOf(draft.madeBy)}`]];
  }
  return changed.map(({ key, field }) => [
    ...describeField(field),
    `, by ${changerOf(draft, key)}`,
  ]);
}

// Under an Approve item that is disabled because the draft depends on a rejected one.
export function WaitingNote() {
  return (
    <Text fz="xs" px="sm" pb={4} className={classes.draftLine}>
      Waiting for a rejected draft to be resubmitted
    </Text>
  );
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
        <DraftMark draft={{ ...draft, reason: undefined }} />
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
