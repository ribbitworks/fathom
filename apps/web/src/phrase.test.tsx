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
