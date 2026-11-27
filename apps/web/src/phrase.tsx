// SPDX-License-Identifier: Apache-2.0

// Words with the parts a reader looks for marked, such as the field and the values in "Name from
// Level to Grade", so they stand out wherever a change is described: a record's menu, the Drafts
// page, and the change history. Their plain text is what search matches.

import { Anchor } from "@mantine/core";
import { Fragment, type ReactNode } from "react";
import classes from "./pages.module.css";

// A part is plain words, a name to stand out, such as a field's, or a value, set apart as a value is
// in code, which links to its record where it names one, as a timeline's do.
export type Phrase = readonly (
  string | { strong: string } | { value: string; onShow?: () => void }
)[];

const partText = (part: Phrase[number]): string => {
  if (typeof part === "string") return part;
  return "strong" in part ? part.strong : part.value;
};

export const phraseText = (phrase: Phrase): string =>
  phrase.map(partText).join("");

const leadingMark = /^[,.;:]/;

// The longest field's name or value kept whole on one line, such as a few days' names, which read
// wrongly split; a longer one, such as a description, wraps as the words around it do.
const wholeLength = 30;

const kept = (words: string, className: string | undefined) =>
  [className, words.length > wholeLength ? "" : classes.phraseWhole].join(" ");

// Whether words start with punctuation straight after a value, whose padding would otherwise set the
// mark apart, as if after a space.
const marksAfterValue = (
  before: Phrase[number] | undefined,
  words: string,
): boolean =>
  before !== undefined &&
  typeof before !== "string" &&
  "value" in before &&
  leadingMark.test(words);

export function PhraseText({ phrase }: { phrase: Phrase }): ReactNode {
  // The parts never change order, so their place names them.
  return phrase.map((part, index) => {
    if (typeof part === "string") {
      return marksAfterValue(phrase[index - 1], part) ? (
        <Fragment key={index}>
          <span className={classes.phraseMark}>{part[0]}</span>
          {part.slice(1)}
        </Fragment>
      ) : (
        part
      );
    }
    return "strong" in part ? (
      <strong key={index} className={kept(part.strong, classes.phraseStrong)}>
        {part.strong}
      </strong>
    ) : (
      <span key={index} className={kept(part.value, classes.phraseValue)}>
        {part.onShow === undefined ? (
          part.value
        ) : (
          <Anchor component="button" type="button" onClick={part.onShow}>
            {part.value}
          </Anchor>
        )}
      </span>
    );
  });
}

// Several phrases in a run, such as a change's fields, each set apart by a semicolon.
export function PhraseList({
  phrases,
  light = false,
}: {
  phrases: readonly Phrase[];
  // Lighter, for one of a column of them in a table.
  light?: boolean;
}) {
  // One run, so a semicolon after a value is drawn against it, as any mark after a value is.
  const run = phrases.flatMap((phrase, index) =>
    index === 0 ? phrase : ["; ", ...phrase],
  );
  const list = <PhraseText phrase={run} />;
  return light ? <span className={classes.phrasesLight}>{list}</span> : list;
}
