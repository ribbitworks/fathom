// SPDX-License-Identifier: Apache-2.0

// Marks on records. A draft is marked by its dot alone, before the record, value or part it marks:
// yellow, hollow while the draft is the user's own and unpublished, or red inside a ring once
// rejected, with the draft's words as the dot's tip and read aloud after the item; what a dot cannot
// say, moved, reordered, retired or restored, follows the item in a small box, and the day a draft
// takes effect, where that needs saying, follows it in grey. Someone else's unpublished changes are a
// grey lock naming them. Live, under a draft, is a green dot first too. A dot always means a draft's
// state; a fact about an item, such as a warning that someone has left or a place still planned, is
// a box after it, as moved or retired is. Every page draws them here, so they show the same marks.

import type { DraftState, Show } from "@fathom/shared";
import { Text, VisuallyHidden } from "@mantine/core";
import { createContext, type ReactNode, useContext } from "react";
import classes from "./pages.module.css";
import marks from "./status-mark.module.css";
import { Icon } from "./icons.tsx";
import { Tipped } from "./table-tips.tsx";

export interface DraftLike {
  action?: "created" | "changed" | "deleted" | undefined;
  state: DraftState;
  reason?: string | undefined;
  // Whether a change retires the record, or restores it, when it does either.
  retiring?: boolean;
  // Whether it moves an item to another place in its list.
  moved?: boolean;
  // Whether it holds the user's own changes, which only they see until they publish them.
  unpublished?: boolean | undefined;
}

const rejectedWord = "Rejected";

// What a draft does to its item, in a word, where it does more than change a value.
type ChangeWord =
  "moved" | "added" | "removed" | "reordered" | "retired" | "restored";

function changeWord(draft: DraftLike): ChangeWord | undefined {
  if (draft.moved === true) return "moved";
  if (draft.action === "created") return "added";
  if (draft.action === "deleted") return "removed";
  if (draft.action === undefined) return "reordered";
  if (draft.retiring !== undefined) {
    return draft.retiring ? "retired" : "restored";
  }
  return undefined;
}

// What a waiting draft does to an item, as Live's words name it.
const waitingChanges: Record<ChangeWord, string> = {
  moved: "A move",
  added: "Its addition",
  removed: "Its removal",
  reordered: "A new order",
  retired: "Its retirement",
  restored: "Its restoration",
};

// Live's words where the view shows only what is live, saying what kind of change waits, so the
// change is named without showing it.
export function liveWaitingWords(draft: DraftLike): string {
  if (draft.unpublished === true) return "Live. A change isn't published yet.";
  const change = changeWord(draft);
  const waiting =
    // The key is one of the union's own.
    // eslint-disable-next-line security/detect-object-injection
    change === undefined ? "A change" : waitingChanges[change];
  return `Live. ${waiting} is waiting for approval.`;
}

// What a draft is, in words, naming what it does, so a rejected one still says what was rejected.
export function draftWords(draft: DraftLike): string {
  const change = changeWord(draft);
  if (draft.state === "rejected") {
    const rejected =
      change === undefined ? rejectedWord : `${rejectedWord}, ${change}`;
    return draft.reason === undefined
      ? rejected
      : `${rejected}: ${draft.reason}`;
  }
  return change === undefined ? "Draft" : `Draft: ${change}`;
}

// What a draft's change says of a value: when it takes effect, who made it, and what the value was,
// where each is known.
interface Change {
  from?: string | undefined;
  by?: string | undefined;
  was?: string | undefined;
}

// The words a draft's dot stands for: its tip, and what is read aloud after the item it marks, with
// what the value was, when the change takes effect and who made it, where those are known, and a
// rejection's reason last, since it is a sentence of its own.
export function draftTip(
  draft: DraftLike,
  { from, by, was }: Change = {},
): string {
  const words = draftWords({ ...draft, reason: undefined });
  const told = [
    was === undefined
      ? words
      : `${words}${words === "Draft" ? ":" : ","} changed from ${was}`,
    ...(draft.unpublished === true ? ["unpublished"] : []),
    ...(from === undefined ? [] : [`from ${from}`]),
    ...(by === undefined ? [] : [`by ${by}`]),
  ].join(", ");
  return draft.state === "rejected" && draft.reason !== undefined
    ? `${told}: ${draft.reason}`
    : told;
}

// A value as it was before a draft changed it, as a dot's tip names it: quoted, cut short when long,
// or, when it was empty, the words for none, such as "no description".
export function wasWords(
  words: string,
  name: string,
  emptyLabel?: string,
): string {
  if (words === "") {
    const none = emptiedWords(name, emptyLabel);
    return none.charAt(0).toLowerCase() + none.slice(1);
  }
  return `“${words.length > wasLength ? `${words.slice(0, wasLength - 1)}…` : words}”`;
}

const wasLength = 40;

// What kind of change a draft is, where its dot cannot say it: shown in a box after the item.
function draftKind(draft: DraftLike): string | undefined {
  if (draft.state === "rejected") return undefined;
  if (draft.moved === true) return "Moved";
  if (draft.action === undefined) return "Reordered";
  if (draft.retiring !== undefined) {
    return draft.retiring ? "Retired" : "Restored";
  }
  return undefined;
}

// The draft a value is marked with when the record's draft changes it, apart from the record's own
// marks in its row's slot: the draft's state, and whether it is the user's own and unpublished, but
// not the kind of change, which belongs to the record.
// The value as it is live, in the record's Live row, is marked Live wherever this marks it.
export function changedValue(
  draft: (DraftLike & { changed: readonly string[] }) | undefined,
  ...fields: (string | undefined)[]
): DraftLike | undefined {
  return draft?.action === "changed" &&
    fields.some((field) => field !== undefined && draft.changed.includes(field))
    ? {
        action: "changed",
        state: draft.state,
        reason: draft.reason,
        unpublished: draft.unpublished,
      }
    : undefined;
}

// A record's own mark, in its row's slot: its draft, unless the draft only changes values the row
// shows, each marked by its own dot, so the slot would only repeat them.
export function recordMark<
  Draft extends DraftLike & { changed?: readonly string[] },
>(draft: Draft | undefined, shown: ReadonlySet<string>): Draft | undefined {
  return draft?.action === "changed" &&
    draft.changed !== undefined &&
    draft.changed.length > 0 &&
    draft.changed.every((field) => shown.has(field))
    ? undefined
    : draft;
}

// The mark of drafts in a record's parts, such as a list's choices or a stream's releases, before
// them: waiting while any waits, and rejected only once every one was. Drafts applied leaves
// rejected drafts out, as it shows them taken back.
export function partsMark(
  drafts: readonly (DraftLike | undefined)[],
  leaveOutRejected = false,
): DraftLike | undefined {
  const counted = drafts.filter(
    (draft): draft is DraftLike =>
      draft !== undefined && !(leaveOutRejected && draft.state === "rejected"),
  );
  if (counted.some(({ state }) => state === "waiting")) {
    return { action: "changed", state: "waiting" };
  }
  return counted.length > 0
    ? { action: "changed", state: "rejected" }
    : undefined;
}

// How many characters a draft's dot takes in a table, with the space after it.
export const draftMarkChars = 2;

type Tone = "draft" | "rejected" | "live" | "unpublished";

const toneClass = new Map<Tone, string | undefined>([
  ["draft", classes.draftMark],
  ["rejected", classes.draftRejected],
  ["live", classes.liveMark],
  ["unpublished", classes.unpublishedMark],
]);

// A draft's tone: red once rejected, otherwise hollow while it holds the user's unpublished changes,
// and yellow.
const draftTone = (draft: DraftLike): Tone =>
  draft.state === "rejected"
    ? "rejected"
    : draft.unpublished === true
      ? "unpublished"
      : "draft";

// A dot alone, in its tone, offering its words as its tip; a rejected draft's dot sits in a ring, so
// it is told apart by its shape as well as its colour.
function Dot({ tone, tip }: { tone: Tone; tip: string }) {
  return (
    <Tipped
      tip={tip}
      className={[toneClass.get(tone), marks.dotPlace].join(" ")}
    >
      <span
        className={[
          classes.statusDot,
          tone === "rejected" ? marks.ringed : "",
        ].join(" ")}
        aria-hidden="true"
      />
    </Tipped>
  );
}

// A draft's dot, offering its words as its tip, with a second, hollow dot when a rejected draft holds
// the user's unpublished changes, since a rejected dot cannot also be hollow.
export function DraftDot({
  draft,
  from,
  by,
  was,
}: {
  draft: DraftLike;
} & Change) {
  return (
    <>
      <Dot tone={draftTone(draft)} tip={draftTip(draft, { from, by, was })} />
      {draft.state === "rejected" && draft.unpublished === true && (
        <Dot tone="unpublished" tip="Unpublished" />
      )}
    </>
  );
}

// The lock's size, as its mark's --mark-size in status-mark.module.css gives it too, so it is
// centred as every mark is.
const lockSize = 12;

// The grey lock of a record someone else has unpublished changes to, naming them in its tip, since
// until they publish or discard them, the user cannot change, approve or reject it.
function HeldDot({ heldBy }: { heldBy: string }) {
  return (
    <Tipped
      tip={`Being changed by ${heldBy}`}
      className={[marks.held, marks.dotPlace].join(" ")}
    >
      <Icon name="lock" size={lockSize} />
    </Tipped>
  );
}

// What a draft does to a part of a record, such as a feature team or feature in a month's cell.
export type DraftedPart = "added" | "removed" | "changed";

const draftedPartWords: Record<DraftedPart, string> = {
  added: ", added",
  removed: ", removed",
  changed: ", changed",
};

// What a draft does to a part, read aloud after it, since the dot and the line through it are seen.
export function DraftedWords({ drafted }: { drafted: DraftedPart }) {
  return (
    // The key is one of the union's own.
    // eslint-disable-next-line security/detect-object-injection
    <VisuallyHidden>{draftedPartWords[drafted]}</VisuallyHidden>
  );
}

const DraftViewContext = createContext<Show>("both");

// The Draft menu's choice, for every mark inside: beside live, a draft's dot; with drafts applied,
// the same, leaving out rejected drafts, which it shows taken back; live only, Live's green dot where
// a draft still waits, so a change waiting is never hidden. A record's Live row is a live view of its
// own. So each mark is given its item's draft whatever the view, and the view decides the mark here
// alone.
export function DraftView({
  show,
  children,
}: {
  show: Show;
  children: ReactNode;
}) {
  return <DraftViewContext value={show}>{children}</DraftViewContext>;
}

// The Draft view around a mark.
export const useDraftView = (): Show => useContext(DraftViewContext);

// Whether a view shows drafts beside live, with tints, semibold changed values and Live rows.
export const besideLive = (show: Show): boolean => show === "both";

// Whether the Draft view around a mark shows drafts beside live.
export const useBesideLive = (): boolean => besideLive(useDraftView());

// What a draft shows as in a view: its dot, Live's, or nothing.
export function viewedDraft<Draft extends DraftLike>(
  draft: Draft | undefined,
  show: Show,
): { draft: Draft | undefined; live: boolean } {
  const waits = draft !== undefined && draft.state !== "rejected";
  if (show === "live") return { draft: undefined, live: waits };
  return {
    draft: show === "drafts" && !waits ? undefined : draft,
    live: false,
  };
}

// Whether a view marks a draft at all, with its dot or Live's.
export function marksIn(draft: DraftLike | undefined, show: Show): boolean {
  const viewed = viewedDraft(draft, show);
  return viewed.draft !== undefined || viewed.live;
}

// A record, value or part as its marks show it, in the Draft view around it: the draft's dot first,
// or a hollow one for the user's own unpublished changes where no draft says so, and a grey lock
// when someone else is changing it; then the item; then its facts; then, where a dot cannot say it,
// the kind of change in a box, and the day it takes effect in grey; and the marks' words, read aloud
// after the item. A part says what the draft does to it, added, removed or changed, in place of the
// draft's own words. A record's row puts its marks in a slot of their own before the row's first
// value, kept even when empty, so every row's marks line up.
export function DraftedItem({
  draft,
  from,
  by,
  was,
  heldBy,
  unpublished = false,
  part,
  slot = false,
  facts,
  children,
}: {
  draft?: DraftLike | undefined;
  // When the drafted change takes effect, where that needs saying.
  from?: string | undefined;
  // Who made the change, where it is one of several people's in one draft.
  by?: string | undefined;
  // What a value was before the draft changed it, in words, as wasWords gives them.
  was?: string | undefined;
  heldBy?: string | undefined;
  // The user's own unpublished changes, where no draft is given to say so, or their words, such as
  // a new row's that is not saved yet.
  unpublished?: boolean | string | undefined;
  part?: DraftedPart | undefined;
  slot?: boolean | undefined;
  // Facts about the item, such as Built in, in boxes after it and before the draft's own box, since
  // a fact tells what the item is and the draft's box what is about to happen to it.
  facts?: ReactNode;
  children: ReactNode;
}) {
  const show = useDraftView();
  const { draft: shown, live } = viewedDraft(draft, show);
  const ownUnpublished =
    draft === undefined && unpublished !== false && show !== "live"
      ? unpublished === true
        ? "Unpublished"
        : unpublished
      : undefined;
  const kind = shown === undefined ? undefined : draftKind(shown);
  const dots = (
    <>
      {shown !== undefined && (
        <DraftDot draft={shown} from={from} by={by} was={was} />
      )}
      {live && draft !== undefined && (
        <Dot tone="live" tip={liveWaitingWords(draft)} />
      )}
      {ownUnpublished !== undefined && (
        <Dot tone="unpublished" tip={ownUnpublished} />
      )}
      {heldBy !== undefined && <HeldDot heldBy={heldBy} />}
    </>
  );
  const spoken = [
    ...(shown === undefined
      ? []
      : part === undefined
        ? [draftTip(shown, { from, by, was })]
        : // A part says what the draft does to it before this, and only whether it was rejected here.
          shown.state === "rejected"
          ? ["rejected"]
          : []),
    ...(live && draft !== undefined ? [liveWaitingWords(draft)] : []),
    ...(ownUnpublished === undefined ? [] : [ownUnpublished]),
    ...(heldBy === undefined ? [] : [`being changed by ${heldBy}`]),
  ];
  return (
    <>
      {slot ? <MarkSlot>{dots}</MarkSlot> : dots}
      {children}
      {facts}
      {kind !== undefined && <KindBox hidden>{kind}</KindBox>}
      {from !== undefined && shown !== undefined && (
        <Text
          span
          c="dimmed"
          size="sm"
          style={{ marginLeft: "var(--fathom-mark-gap)" }}
          aria-hidden="true"
        >
          from {from}
        </Text>
      )}
      {part !== undefined && shown !== undefined && (
        <DraftedWords drafted={part} />
      )}
      {spoken.length > 0 && (
        <VisuallyHidden>, {spoken.join(", ")}</VisuallyHidden>
      )}
    </>
  );
}

// A part of a record a draft adds or takes away, such as a team's member or a manager's report: the
// draft's dot before it, struck through when taken away, and when the change takes effect, where
// that needs saying.
export function DraftedPartItem({
  draft,
  part,
  from,
  children,
}: {
  draft: DraftLike | undefined;
  part: DraftedPart | undefined;
  from?: string | undefined;
  children: ReactNode;
}) {
  const show = useDraftView();
  const marked = part === undefined ? undefined : draft;
  // Struck through only where the view shows the draft taking it away, not live only.
  const struck =
    part === "removed" && viewedDraft(marked, show).draft !== undefined;
  return (
    <DraftedItem draft={marked} part={part} from={from}>
      <span className={struck ? classes.struck : undefined}>{children}</span>
    </DraftedItem>
  );
}

// A small box after an item, saying what a dot cannot, such as Moved, or a fact about it, such as
// Left, centred on the item's text as every mark is.
function KindBox({
  className = "",
  hidden = false,
  children,
}: {
  className?: string | undefined;
  // Whether it is seen only, since its words are read aloud with the rest of the marks.
  hidden?: boolean;
  children: ReactNode;
}) {
  return (
    <span
      className={[marks.kind, className].join(" ")}
      aria-hidden={hidden || undefined}
    >
      <span className={marks.kindWords}>{children}</span>
    </span>
  );
}

// A fact about an item, such as Built in, Left or Planned, in a box after it: grey, or red for a
// warning, the same box a draft's Moved or Retired is drawn in.
export function FactBox({
  tone = "planned",
  alone = false,
  children,
}: {
  tone?: Exclude<OtherTone, "live">;
  // Whether it stands alone, with no item before it, such as a line saying a place is planned.
  alone?: boolean;
  children: ReactNode;
}) {
  return (
    <KindBox
      className={[
        tone === "warning" ? marks.warningKind : marks.plannedKind,
        alone ? marks.alone : "",
      ].join(" ")}
    >
      {children}
    </KindBox>
  );
}

// What an empty value says, in grey, where a draft's mark would otherwise mark nothing, as where a
// draft empties a value, or fills one that was empty: a column's own words for none, or else "No"
// and the value's name.
export function emptiedWords(name: string, emptyLabel?: string): string {
  if (emptyLabel !== undefined) return emptyLabel;
  const [first = "", second = ""] = name;
  return `No ${second === second.toLowerCase() ? first.toLowerCase() + name.slice(1) : name}`;
}

// An empty value's words, in grey italics.
export function EmptiedValue({ name }: { name: string }) {
  return (
    <Text component="span" inherit c="dimmed" fs="italic">
      {emptiedWords(name)}
    </Text>
  );
}

// A row's slot for its record's marks, as wide as a draft's dot and its gap.
function MarkSlot({ children }: { children?: ReactNode }) {
  return <span className={marks.slot}>{children}</span>;
}

// The warning beside someone whose end date has passed, such as a manager who has left.
export const leftWarning = {
  words: "Left",
  spoken: "their end date has passed",
} as const;

// What a mark that is not a draft's says: Live, under a draft, a warning, such as Left, or a planned
// place still to fill.
export type OtherTone = "live" | "warning" | "planned";

// A record, value or part with a mark that is not a draft's. Live is a green dot before the item,
// as a draft's dot is, offering "Live" as its tip and read aloud. A warning, such as Left, or a
// planned place is a fact about the item, not a draft's state, so it is a small box after the item,
// as a draft's Moved or Retired is, outlined red or grey, never a dot: a dot always means a draft's
// state. With no item, it is the box alone, such as a line saying a place is planned; with no tone,
// the item alone.
export function MarkedItem({
  tone,
  words,
  spoken,
  slot = false,
  children,
}: {
  tone: OtherTone | undefined;
  // Shown in the box after the item; Live has none.
  words?: string | undefined;
  // Said only aloud, after the words, such as why.
  spoken?: string | undefined;
  // Whether Live's dot goes in a row's slot for its record's marks, as DraftedItem's does.
  slot?: boolean | undefined;
  children?: ReactNode;
}) {
  if (tone === undefined) {
    return slot ? (
      <>
        <MarkSlot />
        {children}
      </>
    ) : (
      children
    );
  }
  if (tone === "live") {
    const dot = <Dot tone="live" tip="Live" />;
    return (
      <>
        {slot ? <MarkSlot>{dot}</MarkSlot> : dot}
        {children}
        <VisuallyHidden>, live</VisuallyHidden>
      </>
    );
  }
  return (
    <>
      {slot && <MarkSlot />}
      {children}
      {words !== undefined && (
        <FactBox tone={tone} alone={children === undefined}>
          {words}
        </FactBox>
      )}
      {spoken !== undefined && <VisuallyHidden>, {spoken}</VisuallyHidden>}
    </>
  );
}

// A line holding marks and what they mark, such as a value and its dot, or a team's colour and its
// name, on one baseline with no gap of its own, so the marks' own spacing is the only spacing.
export function MarkRow({
  small = false,
  className,
  children,
}: {
  // In a team name's small size, as on a card.
  small?: boolean;
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <span
      className={[marks.markRow, small ? marks.smallRow : "", className].join(
        " ",
      )}
    >
      {children}
    </span>
  );
}

// A live value on a line of its own under its draft, small and dimmed, after Live's dot.
export function LiveLine({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <MarkRow className={[marks.liveLine, className].join(" ")}>
      <MarkedItem tone="live">
        <Text component="span" size="xs" c="dimmed" truncate>
          {children}
        </Text>
      </MarkedItem>
    </MarkRow>
  );
}

type ValueDraft =
  (DraftLike & { changed: readonly string[]; live: object }) | undefined;

// What a value was before its draft changed it, in words for the draft's tip, from the draft's live
// value of its first field, where the draft changes that field.
function wasOf(
  draft: ValueDraft,
  field: string | undefined,
  name: string | undefined,
): string | undefined {
  if (draft === undefined || field === undefined || name === undefined) {
    return undefined;
  }
  if (!draft.changed.includes(field)) return undefined;
  const before: unknown = new Map<string, unknown>(
    Object.entries(draft.live),
  ).get(field);
  return wasWords(typeof before === "string" ? before : "", name);
}

// A value in a record's row as its draft marks it, in the Draft view around it: the draft's dot
// before it where the draft changes it, naming what it was, or, live only, Live's while that draft
// waits. A value the draft empties, or fills, shows its words for none where it is empty, in grey
// italics.
export function DraftedValue({
  draft,
  fields,
  named,
  emptied,
  children,
}: {
  // The record's draft, whatever the view.
  draft: ValueDraft;
  // The record's fields the value shows, the first holding the value.
  fields: readonly string[];
  // The value's name, such as Name, for its tip's words on what it was.
  named?: string | undefined;
  // The value's name, given when it is empty.
  emptied?: string | undefined;
  children?: ReactNode;
}) {
  const changed = changedValue(draft, ...fields);
  return (
    <DraftedItem draft={changed} was={wasOf(draft, fields[0], named)}>
      {emptied !== undefined && changed !== undefined ? (
        <EmptiedValue name={emptied} />
      ) : (
        children
      )}
    </DraftedItem>
  );
}

// The same value in the record's Live row, under its draft row: a green dot before it where the draft
// changes it.
export function LiveValue({
  draft,
  fields,
  emptied,
  children,
}: {
  draft: ValueDraft;
  fields: readonly string[];
  emptied?: string | undefined;
  children?: ReactNode;
}) {
  const changed = changedValue(draft, ...fields) !== undefined;
  return (
    <MarkedItem tone={changed ? "live" : undefined}>
      {emptied !== undefined && changed ? (
        <EmptiedValue name={emptied} />
      ) : (
        children
      )}
    </MarkedItem>
  );
}

// A record's own marks, in its row's slot before its first value, in the Draft view around it: its
// draft's dot, or, live only, Live's while it waits; the lock of someone else's changes; or the user's
// own unpublished changes where no draft says so; then its facts, after the first value.
export function RowMarks({
  mark,
  heldBy,
  unpublished,
  facts,
  children,
}: {
  // The record's draft, whatever the view, where it changes what the row does not show, as
  // recordMark gives it.
  mark: DraftLike | undefined;
  heldBy?: string | undefined;
  unpublished?: boolean | undefined;
  facts?: ReactNode;
  children: ReactNode;
}) {
  return (
    <DraftedItem
      slot
      draft={mark}
      heldBy={heldBy}
      unpublished={unpublished}
      facts={facts}
    >
      {children}
    </DraftedItem>
  );
}

// A record's slot in its Live row: a green dot where its own mark is in the draft row's slot.
export function LiveRowMarks({
  marked,
  children,
}: {
  marked: boolean;
  children: ReactNode;
}) {
  return (
    <MarkedItem slot tone={marked ? "live" : undefined}>
      {children}
    </MarkedItem>
  );
}
