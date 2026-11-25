// SPDX-License-Identifier: Apache-2.0

// Tests for phrases: their plain text, and their parts marked when shown, one by one or in a run.

import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { type Phrase, PhraseList, PhraseText, phraseText } from "./phrase.tsx";

const renamed: Phrase = [
  { strong: "Name" },
  " from ",
  { value: "Level" },
  " to ",
  { value: "Grade" },
];

describe("a phrase", () => {
  it("reads as plain text, and marks its field and values when shown", () => {
    expect(phraseText(renamed)).toBe("Name from Level to Grade");
    const { container } = render(<PhraseText phrase={renamed} />);
    expect(container.textContent).toBe("Name from Level to Grade");
    expect(container.querySelector("strong")?.textContent).toBe("Name");
    expect(
      [...container.querySelectorAll("span")].map(
        ({ textContent }) => textContent,
      ),
    ).toEqual(["Level", "Grade"]);
  });

  it("draws a mark of punctuation straight after a value against it, with nothing between", () => {
    // Given a value followed by a comma, as a draft's line names who made it
    const phrase: Phrase = [
      { strong: "Name" },
      " to ",
      { value: "Spoken languages" },
      ", by Fictional Editor",
    ];

    // When it is shown
    const { container } = render(<PhraseText phrase={phrase} />);

    // Then its text is unchanged, and the comma is drawn against the value
    expect(container.textContent).toBe(
      "Name to Spoken languages, by Fictional Editor",
    );
    const mark = container.querySelector('[class*="phraseMark"]');
    expect(mark?.textContent).toBe(",");
    expect(mark?.previousElementSibling?.textContent).toBe("Spoken languages");
  });

  it("marks punctuation only straight after a value, not after a field's name", () => {
    // Given punctuation after a field's name, and words after a value that start with a space
    const phrase: Phrase = [
      { value: "P1" },
      " and ",
      { strong: "Grade" },
      ", by Fictional Editor",
    ];

    // When it is shown
    const { container } = render(<PhraseText phrase={phrase} />);

    // Then nothing is marked
    expect(container.querySelector('[class*="phraseMark"]')).toBeNull();
  });

  it("marks punctuation that is all of the words after a value", () => {
    const { container } = render(
      <PhraseText phrase={[{ value: "P1" }, "."]} />,
    );
    expect(container.textContent).toBe("P1.");
    expect(container.querySelector('[class*="phraseMark"]')?.textContent).toBe(
      ".",
    );
  });

  it("marks punctuation after a value in the lighter form too", () => {
    const { container } = render(
      <PhraseList
        phrases={[[{ value: "P1" }, ", by Fictional Editor"]]}
        light
      />,
    );
    expect(container.querySelector('[class*="phraseMark"]')?.textContent).toBe(
      ",",
    );
  });

  it("sets several apart with semicolons", () => {
    const { container } = render(
      <PhraseList
        phrases={[renamed, ["Required set to ", { value: "Yes" }]]}
      />,
    );
    expect(container.textContent).toBe(
      "Name from Level to Grade; Required set to Yes",
    );
  });
});
