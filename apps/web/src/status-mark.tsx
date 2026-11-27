// SPDX-License-Identifier: Apache-2.0

// Marks on records: a draft's dot, the boxes for what a dot can't say and for facts, the lock,
// Live's dot and data classes' symbols, drawn the same on every page.

import {
  classNames,
  hasEnded,
  type Show,
  type ScheduleEnd,
  type Tier,
} from "@fathom/shared";
import { Text, VisuallyHidden } from "@mantine/core";
import { createContext, type ReactNode, useContext } from "react";
import classes from "./pages.module.css";
import marks from "./status-mark.module.css";
import { Icon, type IconName } from "./icons.tsx";
import { Tipped } from "./table-tips.tsx";
import {
  type Change,
  changedValue,
  type DraftLike,
  draftKind,
  draftTip,
  liveWaitingWords,
  type Was,
  wasWords,
} from "./draft-marks.ts";

// How many characters a draft's dot takes in a table, with the space after it.
export const draftMarkChars = 2;

// How many characters a box such as Moved takes beyond its word, for its padding and the gap before
// it.
const kindBoxChars = 2;

export type Tone = "draft" | "rejected" | "live" | "unpublished" | "private";

const toneClass = new Map<Tone, string | undefined>([
  ["draft", classes.draftMark],
  ["rejected", classes.draftRejected],
  ["live", classes.liveMark],
  ["unpublished", classes.unpublishedMark],
  ["private", classes.privateMark],
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
// Before a figure, a ring keeps the same gap to it as a plain dot does.
function Dot({
  tone,
  tip,
  beforeFigure = false,
}: {
  tone: Tone;
  tip: string;
  beforeFigure?: boolean;
}) {
  return (
    <Tipped
      tip={tip}
      className={[toneClass.get(tone), marks.dotPlace].join(" ")}
    >
      <span
        className={[
          classes.statusDot,
          tone === "rejected" ? marks.ringed : "",
          tone === "rejected" && beforeFigure ? marks.ringedFigure : "",
        ].join(" ")}
        aria-hidden="true"
      />
    </Tipped>
  );
}

// The violet ring before the name of a page only its maker sees, read aloud where nothing else says
// the page is private.
export function PrivateRing({ spoken = false }: { spoken?: boolean }) {
  const tip = "Private. Nobody else sees this page.";
  return (
    <>
      <Dot tone="private" tip={tip} />
      {spoken && <VisuallyHidden>{`${tip} `}</VisuallyHidden>}
    </>
  );
}

// A draft's dot, offering its words as its tip, with a second, hollow dot when a rejected draft holds
// the user's unpublished changes, since a rejected dot cannot also be hollow.
export function DraftDot({
  draft,
  from,
  by,
  was,
  emptied,
}: {
  draft: DraftLike;
} & Change) {
  return (
    <>
      <Dot
        tone={draftTone(draft)}
        tip={draftTip(draft, { from, by, was, emptied })}
      />
      {draft.state === "rejected" && draft.unpublished === true && (
        <Dot tone="unpublished" tip="Unpublished" />
      )}
    </>
  );
}

// A figure after the dot of the draft that moves it, as a value a draft changes has, saying in its
// tip what moves it.
export function MarkedFigure({
  mark,
  children,
}: {
  mark: { tone: Tone; tip: string } | undefined;
  children: ReactNode;
}) {
  if (mark === undefined) return children;
  return (
    <>
      <Dot tone={mark.tone} tip={mark.tip} beforeFigure />
      {children}
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
  emptied,
  heldBy,
  unpublished = false,
  privately = false,
  part,
  slot = false,
  dataClass,
  facts,
  children,
}: {
  draft?: DraftLike | undefined;
  // When the drafted change takes effect, where that needs saying.
  from?: string | undefined;
  // Who made the change, where it is one of several people's in one draft.
  by?: string | undefined;
  // What a value was before the draft changed it, in words, as wasWords gives them.
  was?: Was | undefined;
  // Whether the draft leaves the value empty.
  emptied?: boolean | undefined;
  heldBy?: string | undefined;
  // The user's own unpublished changes, where no draft is given to say so, or their words, such as
  // a new row's that is not saved yet.
  unpublished?: boolean | string | undefined;
  // Whether those unpublished changes are on a page only its maker sees, which has no drafts, so
  // their hollow dot is in the private violet rather than the drafts' yellow.
  privately?: boolean | undefined;
  part?: DraftedPart | undefined;
  slot?: boolean | undefined;
  // The class of the item's values, marked between its draft's dots and the item.
  dataClass?: Tier | undefined;
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
        <DraftDot
          draft={shown}
          from={from}
          by={by}
          was={was}
          emptied={emptied}
        />
      )}
      {live && draft !== undefined && (
        <Dot tone="live" tip={liveWaitingWords(draft)} />
      )}
      {ownUnpublished !== undefined && (
        <Dot
          tone={privately ? "private" : "unpublished"}
          tip={ownUnpublished}
        />
      )}
      {heldBy !== undefined && <HeldDot heldBy={heldBy} />}
    </>
  );
  const spoken = [
    ...classWords(dataClass),
    ...(shown === undefined
      ? []
      : part === undefined
        ? [draftTip(shown, { from, by, was, emptied })]
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
      {dataClass !== undefined && <ClassMark dataClass={dataClass} />}
      {children}
      {facts}
      {kind !== undefined && <KindBox hidden>{kind}</KindBox>}
      {from !== undefined && shown !== undefined && (
        <FromDay day={from} hidden />
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

// How many characters the marks DraftedItem draws around an item take, in a Draft view: a dot for
// the draft or Live, one for a lock, and the box a dot cannot say, such as Moved.
export function draftedItemChars(
  draft: DraftLike | undefined,
  show: Show,
  heldBy: string | undefined,
): number {
  const { draft: shown, live } = viewedDraft(draft, show);
  const dots = [shown !== undefined, live, heldBy !== undefined].filter(
    Boolean,
  ).length;
  const kind = shown === undefined ? undefined : draftKind(shown);
  return (
    dots * draftMarkChars +
    (kind === undefined ? 0 : kind.length + kindBoxChars)
  );
}

const partActions = {
  added: "created",
  removed: "deleted",
  changed: "changed",
} as const satisfies Record<DraftedPart, DraftLike["action"]>;

// A part of a record a draft adds or takes away, such as a team's member or a manager's report: the
// draft's dot before it, struck through when taken away, and when the change takes effect, where
// that needs saying. The part as it is live, where a draft changes it, has Live's dot instead: in a
// Live row beside its draft, and, live only, naming the change waiting.
export function DraftedPartItem({
  draft,
  part,
  from,
  live = false,
  children,
}: {
  draft: DraftLike | undefined;
  part: DraftedPart | undefined;
  from?: string | undefined;
  live?: boolean | undefined;
  children: ReactNode;
}) {
  const show = useDraftView();
  // Named by what it does to the part, whatever the record's own draft does, if it names anything.
  const partDraft =
    draft === undefined
      ? undefined
      : {
          ...draft,
          action: partActions[part ?? "changed"],
        };
  if (live) {
    return show === "live" ? (
      <DraftedItem draft={partDraft}>{children}</DraftedItem>
    ) : (
      <MarkedItem tone={partDraft === undefined ? undefined : "live"}>
        {children}
      </MarkedItem>
    );
  }
  const marked = part === undefined ? undefined : partDraft;
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

// A schedule's Ended, once its last day has passed.
export function EndedBox({
  stream,
  day,
}: {
  stream: ScheduleEnd;
  day: string;
}) {
  return hasEnded(stream, day) && <FactBox>Ended</FactBox>;
}

// The words for a class's mark, as a header's spoken name adds them: none for General.
export const classWords = (dataClass: Tier | undefined): string[] =>
  dataClass === undefined || dataClass === "general"
    ? []
    : // The class is always one of the fixed classes.
      // eslint-disable-next-line security/detect-object-injection
      [classNames[dataClass]];

const classSymbols: Record<Tier, IconName> = {
  general: "generalData",
  personal: "personalData",
  confidential: "confidentialData",
};

// How many characters a class's mark takes, as a header's width counts it: a symbol, as wide as a
// draft's dot with its gap.
export const classMarkChars = (dataClass: Tier | undefined): number =>
  classWords(dataClass).length * draftMarkChars;

function ClassSymbol({ dataClass }: { dataClass: Tier }) {
  return (
    // The class is always one of the fixed classes.
    // eslint-disable-next-line security/detect-object-injection
    <Icon name={classSymbols[dataClass]} size={lockSize} />
  );
}

// The class of data an item's values belong to, as its symbol before the item, so nobody shares
// them by mistake, naming the class as its tip; nothing for General, which everyone reaching the page
// sees. The item it marks says the class aloud.
function ClassMark({ dataClass }: { dataClass: Tier }) {
  return classWords(dataClass).map((words) => (
    <Tipped
      key={words}
      tip={words}
      className={[marks.classSymbol, marks.dotPlace].join(" ")}
    >
      <ClassSymbol dataClass={dataClass} />
    </Tipped>
  ));
}

// A class named in words, its symbol before its name. General has a symbol here too, so no class in
// a list of them is drawn differently, though an item in General is left unmarked.
export function ClassName({ dataClass }: { dataClass: Tier }) {
  return (
    <span className={marks.className}>
      <span className={[marks.classSymbol, marks.dotPlace].join(" ")}>
        <ClassSymbol dataClass={dataClass} />
      </span>
      {/* The class is always one of the fixed classes. */}
      {/* eslint-disable-next-line security/detect-object-injection */}
      {classNames[dataClass]}
    </span>
  );
}

// An empty side a dot alone shows, read aloud as empty after the dot's own words.
export function EmptyLive() {
  return <VisuallyHidden>, empty</VisuallyHidden>;
}

// The place of a value a dot alone shows, a line's height though empty, so the dot sits on the line
// as it does before a value.
export function EmptySide() {
  return <span className={marks.emptySide} aria-hidden />;
}

// Text Fathom fills in, such as a planned hire's name made from its position and ID, in grey
// italics.
export function FilledIn({
  className,
  children,
}: {
  className?: string | undefined;
  children: ReactNode;
}) {
  return (
    <Text component="span" inherit c="dimmed" fs="italic" className={className}>
      {children}
    </Text>
  );
}

// The day something takes effect, or took effect, in grey after it, such as from Dec 1, 2026;
// hidden from screen readers where a tip already says it.
export function FromDay({
  day,
  hidden = false,
}: {
  day: string;
  hidden?: boolean;
}) {
  return (
    <Text
      span
      c="dimmed"
      size="sm"
      className={marks.fromDay}
      aria-hidden={hidden ? "true" : undefined}
    >
      from {day}
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
// state. A warning with no value before it, such as No feature team in an empty cell, is its words
// in red in the value's place, with no box. With no item, a planned place is the box alone, such
// as a line saying a place is planned; with no tone, the item alone.
export function MarkedItem({
  tone,
  words,
  spoken,
  slot = false,
  empty = false,
  children,
}: {
  tone: OtherTone | undefined;
  // Shown in the box after the item; Live has none.
  words?: string | undefined;
  // Said only aloud, after the words, such as why.
  spoken?: string | undefined;
  // Whether Live's dot goes in a row's slot for its record's marks, as DraftedItem's does.
  slot?: boolean | undefined;
  // Whether the item is an empty value, so a warning stands in its place.
  empty?: boolean | undefined;
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
  const alone = children === undefined;
  return (
    <>
      {slot && <MarkSlot />}
      {children}
      {words !== undefined &&
        (tone === "warning" && (alone || empty) ? (
          <span className={marks.warningWords}>{words}</span>
        ) : (
          <FactBox tone={tone} alone={alone}>
            {words}
          </FactBox>
        ))}
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
  empty = false,
  children,
}: {
  className?: string | undefined;
  // Whether the live value is empty, read aloud as live, then empty.
  empty?: boolean | undefined;
  children?: ReactNode;
}) {
  return (
    <MarkRow className={[marks.liveLine, className].join(" ")}>
      <MarkedItem tone="live">
        <Text component="span" size="xs" c="dimmed" truncate>
          {empty ? <EmptySide /> : children}
        </Text>
      </MarkedItem>
      {empty && <EmptyLive />}
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
): Was | undefined {
  if (draft === undefined || field === undefined || name === undefined) {
    return undefined;
  }
  if (!draft.changed.includes(field)) return undefined;
  const before: unknown = new Map<string, unknown>(
    Object.entries(draft.live),
  ).get(field);
  return wasWords(typeof before === "string" ? before : "");
}

// A value in a record's row as its draft marks it, in the Draft view around it: the draft's dot
// before it where the draft changes it, naming what it was, or, live only, Live's while that draft
// waits. A value the draft empties is its dot alone.
export function DraftedValue({
  draft,
  fields,
  named,
  emptied,
  dataClass,
  children,
}: {
  // The record's draft, whatever the view.
  draft: ValueDraft;
  // The record's fields the value shows, the first holding the value.
  fields: readonly string[];
  // The value's name, such as Name, given where its tip says what it was.
  named?: string | undefined;
  // Whether the value is empty.
  emptied?: boolean | undefined;
  dataClass?: Tier | undefined;
  children?: ReactNode;
}) {
  const changed = changedValue(draft, ...fields);
  return (
    <DraftedItem
      draft={changed}
      was={wasOf(draft, fields[0], named)}
      emptied={emptied}
      dataClass={dataClass}
    >
      {emptied === true && changed !== undefined ? <EmptySide /> : children}
    </DraftedItem>
  );
}

// The same value in the record's Live row, under its draft row: a green dot before it where the draft
// changes it, alone where the value was empty.
export function LiveValue({
  draft,
  fields,
  emptied,
  children,
}: {
  draft: ValueDraft;
  fields: readonly string[];
  // Whether the value is empty.
  emptied?: boolean | undefined;
  children?: ReactNode;
}) {
  const changed = changedValue(draft, ...fields) !== undefined;
  return (
    <>
      <MarkedItem tone={changed ? "live" : undefined}>
        {emptied === true && changed ? <EmptySide /> : children}
      </MarkedItem>
      {emptied === true && changed && <EmptyLive />}
    </>
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
