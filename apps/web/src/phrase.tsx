// SPDX-License-Identifier: Apache-2.0

// Words with the parts a reader looks for marked, such as the field and the values in "Name from
// Level to Grade", so they stand out wherever a change is described: a record's menu, the Drafts
// page, and the change history. Their plain text is what search matches.

import { Fragment, type ReactNode } from "react";
import classes from "./pages.module.css";

// A part is plain words, a name to stand out, such as a field's, or a value, set apart as a value is
// in code.
export type Phrase = readonly (
  string | { strong: string } | { value: string }
)[];

const partText = (part: Phrase[number]): string => {
  if (typeof part === "string") return part;
  return "strong" in part ? part.strong : part.value;
};

export const phraseText = (phrase: Phrase): string =>
  phrase.map(partText).join("");

const leadingMark = /^[,.;:]/;

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
      <strong key={index} className={classes.phraseStrong}>
        {part.strong}
      </strong>
    ) : (
      <span key={index} className={classes.phraseValue}>
        {part.value}
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
  const list = phrases.map((phrase, index) => (
    <span key={index}>
      {index > 0 && "; "}
      <PhraseText phrase={phrase} />
    </span>
  ));
  return light ? <span className={classes.phrasesLight}>{list}</span> : list;
}
