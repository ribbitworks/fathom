// SPDX-License-Identifier: Apache-2.0

// A record's details in a side panel, on any page: a value in its row under its label, changed in
// place for those who may, with a draft's live value under it, and a link to another record that
// shows it instead.

import type { Link as WebLink } from "@fathom/shared";
import { ActionIcon, Anchor, Group, Stack, Text } from "@mantine/core";
import {
  type MouseEvent,
  type ReactNode,
  useEffect,
  useEffectEvent,
} from "react";
import { cellKinds } from "./cell-kinds.tsx";
import { ColouredName } from "./colour-swatch.tsx";
import { Icon } from "./icons.tsx";
import { LinkCell } from "./link-field.tsx";
import { FoldedNote } from "./folded-note.tsx";
import { focusSoon } from "./focus.ts";
import { OpenBesideButton } from "./row-controls.tsx";
import {
  changeId,
  type Editing,
  labelId,
  problemId,
} from "./record-editing.tsx";
import classes from "./record-details.module.css";
import { roundedUpTo } from "@fathom/shared";
import { isEmpty, shownInView } from "./grid-columns.tsx";
import { cellDraftOf } from "./grid-drafts.ts";
import type { Column, GridRecord } from "./record-table.ts";
import { SidePanelFrame, sidePanelScroll } from "./side-panel.tsx";
import {
  DraftedItem,
  DraftedValue,
  MarkedItem,
  MarkRow,
  useBesideLive,
} from "./status-mark.tsx";
import { type DraftLike, wasWords, emptiedWords } from "./draft-marks.ts";
import {
  type CellValue,
  type ColumnUnit,
  unitAmountWords,
  type View,
} from "./table-view.ts";

type DetailColumn = Pick<
  Column<never>,
  "key" | "label" | "kind" | "multiple" | "choices" | "required" | "emptyLabel"
>;

// A value as it was before a draft changed it, for its draft's tip; none for a note or a link,
// whose words a tip cannot hold.
function liveWords(column: DetailColumn, value: unknown): string | undefined {
  if (column.kind === "note" || column.kind === "link") return undefined;
  const kind = cellKinds[column.kind];
  return wasWords(
    kind.inWords(column, value as Parameters<typeof kind.inWords>[1]),
    column.label,
    column.emptyLabel,
  );
}

// A value, or, when empty, None or the column's own word for it, dimmed; where a draft empties the
// value, or fills it, the words for none in grey italics, as a table's cell shows them.
function Value({
  column,
  value,
  drafted = false,
  onOpenNote,
}: {
  column: DetailColumn;
  value: unknown;
  drafted?: boolean;
  // Opens a note in its own panel, for Show more under a folded note.
  onOpenNote?: (() => void) | undefined;
}) {
  const kind = cellKinds[column.kind];
  const none = drafted ? (
    <Text c="dimmed" fs="italic">
      {emptiedWords(column.label, column.emptyLabel)}
    </Text>
  ) : (
    <Text c="dimmed">{column.emptyLabel ?? "None"}</Text>
  );
  if (column.kind === "note") {
    return value === "" ? (
      none
    ) : (
      <FoldedNote
        name={column.label}
        note={value as string}
        onOpen={onOpenNote}
      />
    );
  }
  if (column.kind === "link") {
    return value === null ? (
      none
    ) : (
      <LinkCell link={value as WebLink} inTable={false} />
    );
  }
  const words = kind.inWords(
    column,
    value as Parameters<typeof kind.inWords>[1],
  );
  return words === "" ? none : <Text>{words}</Text>;
}

// A value with a unit in words, the unit spelled out, as a panel has room to, such as 1 person-week,
// one or several as the amount is shown, rounded up to the column's places, if any.
function spelledOut(
  column: DetailColumn & Pick<Column<never>, "places">,
  unit: ColumnUnit,
  value: string,
): string {
  const shown = cellKinds[column.kind].inWords(
    { ...column, unit: undefined },
    value,
  );
  const amount =
    column.places === undefined
      ? Number(value)
      : roundedUpTo(Number(value), column.places);
  return unitAmountWords(shown, amount, unit);
}

// For a column that offers units, a record's value as its row shows it, with the units spelled out:
// in the unit the table shows, when that is another and the value is more than 0, followed by the
// value in the column's first unit, as kept, such as 2.5 person-days (20 hours).
export function inUnitsWords(
  column: Column<never>,
  view: Pick<View, "units" | "places">,
  record: object,
): string | undefined {
  const { units } = column;
  if (units === undefined) return undefined;
  const value = column.value(record as never) as string;
  if (value === "") return undefined;
  const kept = spelledOut(column, units.offered[0], value);
  const shown = shownInView(column, units, view);
  const shownValue = shown.column.value(record as never) as string;
  return shown.unit.key === units.offered[0].key || Number(shownValue) <= 0
    ? kept
    : `${spelledOut(shown.column, shown.unit, shownValue)} (${kept})`;
}

// A record's details beside its table: its name as the panel's heading, marked with the draft of the
// record as a whole, who holds it and its facts, and with its name's draft; focus goes to the name
// as each record opens. Its sections scroll under the heading.
export function RecordPanel({
  id,
  titleId,
  recordId,
  title,
  narrow,
  draft,
  nameDraft,
  heldBy,
  facts,
  subtitle,
  onClose,
  children,
}: {
  id: string;
  titleId: string;
  recordId: string;
  title: string;
  // The line under the title, such as the record's key.
  subtitle?: ReactNode;
  narrow: boolean;
  draft?: DraftLike | undefined;
  // The record's draft, whatever the view, which marks its name where it changes it.
  nameDraft?: Parameters<typeof DraftedValue>[0]["draft"];
  heldBy?: string | undefined;
  facts?: ReactNode;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    focusSoon(titleId);
  }, [recordId, titleId]);
  return (
    <SidePanelFrame
      id={id}
      titleId={titleId}
      narrow={narrow}
      title={title}
      marked={(heading) => (
        <DraftedItem draft={draft} heldBy={heldBy} facts={facts}>
          <DraftedValue draft={nameDraft} fields={["name"]} named="Name">
            {heading}
          </DraftedValue>
        </DraftedItem>
      )}
      subtitle={subtitle}
      close={{ label: "Close details", onClose }}
    >
      <div className={sidePanelScroll}>
        <DetailSections>{children}</DetailSections>
      </div>
    </SidePanelFrame>
  );
}

// A details panel's sections, one under another with room between, as every panel spaces them.
export function DetailSections({ children }: { children: ReactNode }) {
  return <Stack gap="lg">{children}</Stack>;
}

// A headed section of a record's details: a list of its rows, or another body, such as a small
// table.
export function RecordSection({
  id,
  title,
  children,
  body,
}: {
  id: string;
  title: string;
} & (
  | { children: ReactNode; body?: undefined }
  | { body: ReactNode; children?: undefined }
)) {
  return (
    <section aria-labelledby={id}>
      <h3 className={classes.heading} id={id}>
        {title}
      </h3>
      {body ?? <dl className={classes.list}>{children}</dl>}
    </section>
  );
}

export function RecordLink({
  id,
  name,
  onShow,
}: {
  // Where focus can come back to, once what the link shows closes.
  id?: string;
  name: ReactNode;
  onShow: () => void;
}) {
  return (
    <Anchor
      id={id}
      component="button"
      type="button"
      ta="start"
      onClick={onShow}
    >
      {name}
    </Anchor>
  );
}

// A record named in a details panel, by its link, which shows its details.
export interface RecordLinkItem {
  id: string;
  name: ReactNode;
  onShow: () => void;
  // Marks drawn around the link, such as its record's draft.
  around?: ((link: ReactNode) => ReactNode) | undefined;
}

// Links to records, one to a line, as a details panel lists several records.
export function RecordLinkList({
  links,
}: {
  links: readonly RecordLinkItem[];
}) {
  return (
    <Stack gap={0} align="flex-start">
      {links.map(({ id, name, onShow, around }) => {
        const link = <RecordLink name={name} onShow={onShow} />;
        return (
          <span key={id}>{around === undefined ? link : around(link)}</span>
        );
      })}
    </Stack>
  );
}

// What a row's change button is, named Change and the row's label, for a row's own control, such as a
// menu, that changes its value. It shows while its row is pointed at or has focus.
export const changeButton = (label: string) =>
  ({
    variant: "subtle",
    color: "gray",
    size: "sm",
    className: classes.change,
    "aria-label": `Change ${label}`,
    children: <Icon name="edit" />,
  }) as const;

// A row's click handler that opens its editor from a click anywhere on it, but not on a link or a
// control in it, as the button beside it does; a click in its own menu, drawn elsewhere, still
// reaches it, and is left. None for a row with no editor to open.
export const opensOnClick = (start: (() => void) | undefined) =>
  start === undefined
    ? undefined
    : (event: MouseEvent) => {
        const target = event.target as HTMLElement;
        if (
          event.currentTarget.contains(target) &&
          target.closest("a, button") === null
        ) {
          start();
        }
      };

export function Row({
  column,
  value,
  colour = null,
  changed,
  editing,
  children,
  action,
}: {
  column: DetailColumn;
  value: CellValue;
  // The value's colour, such as its team's, drawn as the colour's square before it.
  colour?: string | null;
  // What a draft changes here, whatever the Draft view, which decides how it shows: the live value,
  // shown under the drafted one beside live where given, the draft to mark it with, if any, and the
  // day or month the change takes effect from, where that needs saying.
  changed?:
    | {
        live?: CellValue;
        // The live value's colour, where it has one, for its square under the drafted value.
        liveColour?: string | null;
        draft?: DraftLike | undefined;
        from?: string | undefined;
        // A warning about the live value, such as a manager who has left.
        warning?: { words: string; spoken?: string } | undefined;
      }
    | undefined;
  editing?: Editing | undefined;
  children?: ReactNode;
  // A control of its own at the row's right, after the change button if there is one, such as a menu.
  action?: ReactNode;
}) {
  const draft = changed?.draft;
  const liveUnder =
    useBesideLive() && changed?.live !== undefined
      ? { ...changed, live: changed.live }
      : undefined;
  const start = editing?.open === true ? undefined : editing?.onStart;
  const openAsked = useEffectEvent(() => {
    editing?.onAsked?.();
  });
  const asked = editing?.askedBy;
  useEffect(() => {
    if (asked !== undefined) openAsked();
  }, [asked]);
  const onClick = opensOnClick(start);
  const checkbox = editing !== undefined && editing.onStart === undefined;
  return (
    <div
      className={[
        classes.row,
        onClick === undefined ? "" : classes.editable,
      ].join(" ")}
      data-field={editing?.open === true || undefined}
      onClick={onClick}
    >
      <dt id={labelId(column)} className={classes.label}>
        {column.label}
      </dt>
      <dd className={classes.value}>
        {editing?.open === true ? (
          editing.editor
        ) : (
          <Group
            gap={6}
            wrap="nowrap"
            justify="space-between"
            align="flex-start"
          >
            <MarkRow>
              <DraftedItem
                draft={draft}
                from={changed?.from}
                was={
                  changed?.live === undefined
                    ? undefined
                    : liveWords(column, changed.live)
                }
              >
                {checkbox ? (
                  editing.editor
                ) : (
                  <ColouredName
                    colour={
                      children === undefined && isEmpty(value) ? null : colour
                    }
                  >
                    {children ?? (
                      <Value
                        column={column}
                        value={value}
                        drafted={draft !== undefined}
                        onOpenNote={start}
                      />
                    )}
                  </ColouredName>
                )}
              </DraftedItem>
            </MarkRow>
            {(start !== undefined || Boolean(action)) && (
              <Group gap={4} wrap="nowrap">
                {start !== undefined &&
                  (cellKinds[column.kind].inPanel === true ? (
                    // A value opened in its own panel, such as a note, is read there first.
                    <OpenBesideButton
                      id={changeId(column)}
                      className={classes.change}
                      label={`Open ${column.label}`}
                      onOpen={start}
                    />
                  ) : (
                    <ActionIcon
                      id={changeId(column)}
                      {...changeButton(column.label)}
                      onClick={start}
                    />
                  ))}
                {action}
              </Group>
            )}
          </Group>
        )}
        {editing?.problem !== undefined && (
          <Text id={problemId(column)} c="red" size="sm" mt={4}>
            {editing.problem}
          </Text>
        )}
        {liveUnder !== undefined && (
          <MarkRow className={classes.live}>
            <MarkedItem tone="live">
              <MarkedItem
                tone={liveUnder.warning === undefined ? undefined : "warning"}
                words={liveUnder.warning?.words}
                spoken={liveUnder.warning?.spoken}
              >
                <ColouredName
                  colour={
                    isEmpty(liveUnder.live)
                      ? null
                      : (liveUnder.liveColour ?? null)
                  }
                >
                  <Value column={column} value={liveUnder.live} drafted />
                </ColouredName>
              </MarkedItem>
            </MarkedItem>
          </MarkRow>
        )}
      </dd>
    </div>
  );
}

// A record's details from its table's columns, in the table's order, each a row with the column's
// label, the record's value, its colour and its draft's marks, and a pencil where it can be changed:
// the record as the Draft view shows it, its draft whatever the view, which marks each value it
// changes, and the record as it is live, for a changed value's colour under it.
export function ColumnRows<Rec extends GridRecord, Change>({
  columns,
  shown,
  draft,
  live,
  changeOf,
  actionOf = () => undefined,
}: {
  columns: readonly Column<Rec, Change>[];
  shown: Rec;
  draft: NonNullable<Rec["draft"]> | undefined;
  live: Rec;
  // What opens a change to a column's value, such as a dialog, where it may be changed.
  changeOf: (column: Column<Rec, Change>) => (() => void) | undefined;
  // A control of its own for a value with no pencil, such as a menu of ways to change it.
  actionOf?: (column: Column<Rec, Change>) => ReactNode;
}) {
  return (
    <>
      {columns.map((column) => {
        const value = column.value(shown);
        const change = changeOf(column);
        return (
          <Row
            key={column.key}
            column={column}
            value={value}
            colour={column.colour?.(shown) ?? null}
            changed={
              draft?.changed.includes(column.key) === true
                ? {
                    live: column.live(draft),
                    liveColour: column.colour?.(live) ?? null,
                    // A value another record's draft changes is marked by that draft.
                    draft: cellDraftOf(shown.cellDrafts, column) ?? draft,
                  }
                : undefined
            }
            action={
              change === undefined ? (
                actionOf(column)
              ) : (
                <ActionIcon {...changeButton(column.label)} onClick={change} />
              )
            }
          >
            {isEmpty(value) ? undefined : column.content?.(shown)}
          </Row>
        );
      })}
    </>
  );
}
