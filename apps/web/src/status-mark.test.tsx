// SPDX-License-Identifier: Apache-2.0

// Tests of the marks on drafts: their words, the one rule that decides each mark in each Draft view,
// and the shared pieces that draw a record's row, its values and its parts.

import type { Show } from "@fathom/shared";
import { MantineProvider } from "@mantine/core";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
  classMarkChars,
  classWords,
  changedValue,
  type DraftLike,
  DraftedItem,
  DraftedPartItem,
  DraftedValue,
  draftTip,
  DraftView,
  draftWords,
  emptiedWords,
  liveWaitingWords,
  LiveRowMarks,
  LiveValue,
  MarkedItem,
  marksIn,
  partsMark,
  recordMark,
  RowMarks,
  viewedDraft,
  wasWords,
} from "./status-mark.tsx";
import { testTheme } from "./test-support.tsx";

const waiting: DraftLike = { action: "changed", state: "waiting" };
const rejected: DraftLike = {
  action: "changed",
  state: "rejected",
  reason: "Fictional reason.",
};

function renderIn(show: Show, node: ReactNode) {
  return render(
    <MantineProvider theme={testTheme}>
      <DraftView show={show}>{node}</DraftView>
    </MantineProvider>,
  );
}

describe("a draft's words", () => {
  it("names what a waiting draft does", () => {
    expect(draftWords(waiting)).toBe("Draft");
    expect(draftWords({ action: "created", state: "waiting" })).toBe(
      "Draft: added",
    );
    expect(draftWords({ action: "deleted", state: "waiting" })).toBe(
      "Draft: removed",
    );
    expect(draftWords({ state: "waiting" })).toBe("Draft: reordered");
    expect(draftWords({ ...waiting, moved: true })).toBe("Draft: moved");
    expect(draftWords({ ...waiting, retiring: true })).toBe("Draft: retired");
    expect(draftWords({ ...waiting, retiring: false })).toBe("Draft: restored");
  });

  it("says what a rejected draft did, and why, when it says", () => {
    expect(draftWords({ action: "changed", state: "rejected" })).toBe(
      "Rejected",
    );
    expect(draftWords(rejected)).toBe("Rejected: Fictional reason.");
    expect(
      draftWords({ action: "created", state: "rejected", reason: "Too soon." }),
    ).toBe("Rejected, added: Too soon.");
  });

  it("adds what a value was, when it takes effect and who changed it", () => {
    expect(
      draftTip(
        { ...waiting, unpublished: true },
        { was: "“Level”", from: "Dec 1, 2026", by: "Fictional Person" },
      ),
    ).toBe(
      "Draft: changed from “Level”, unpublished, from Dec 1, 2026, by Fictional Person",
    );
    expect(draftTip({ action: "created", state: "waiting" }, {})).toBe(
      "Draft: added",
    );
  });

  it("keeps a rejection's reason last, after what the value was", () => {
    expect(draftTip(rejected, { was: "“Harbor 2”" })).toBe(
      "Rejected, changed from “Harbor 2”: Fictional reason.",
    );
  });

  it("says what kind of change waits, where only the live record shows", () => {
    expect(liveWaitingWords(waiting)).toBe(
      "Live. A change is waiting for approval.",
    );
    expect(liveWaitingWords({ action: "deleted", state: "waiting" })).toBe(
      "Live. Its removal is waiting for approval.",
    );
    expect(liveWaitingWords({ ...waiting, moved: true })).toBe(
      "Live. A move is waiting for approval.",
    );
    expect(liveWaitingWords({ state: "waiting" })).toBe(
      "Live. A new order is waiting for approval.",
    );
    expect(liveWaitingWords({ ...waiting, unpublished: true })).toBe(
      "Live. A change isn't published yet.",
    );
  });

  it("quotes what a value was, cut short when long, or names it as none", () => {
    expect(wasWords("Level", "Name")).toBe("“Level”");
    expect(wasWords("", "Description")).toBe("no description");
    expect(wasWords("", "Start", "Later")).toBe("later");
    expect(wasWords("x".repeat(50), "Name")).toBe(`“${"x".repeat(39)}…”`);
    expect(emptiedWords("ID")).toBe("No ID");
    expect(emptiedWords("Start")).toBe("No start");
  });
});

describe("the Draft view's rule", () => {
  it("shows a draft beside live, rejected ones too", () => {
    expect(viewedDraft(waiting, "both")).toEqual({
      draft: waiting,
      live: false,
    });
    expect(viewedDraft(rejected, "both")).toEqual({
      draft: rejected,
      live: false,
    });
  });

  it("leaves rejected drafts out with the drafts applied", () => {
    expect(viewedDraft(waiting, "drafts").draft).toBe(waiting);
    expect(viewedDraft(rejected, "drafts")).toEqual({
      draft: undefined,
      live: false,
    });
  });

  it("marks only waiting drafts, as Live, live only", () => {
    expect(viewedDraft(waiting, "live")).toEqual({
      draft: undefined,
      live: true,
    });
    expect(viewedDraft(rejected, "live").live).toBe(false);
    expect(viewedDraft(undefined, "live").live).toBe(false);
  });

  it("says whether a view marks a draft at all", () => {
    expect(marksIn(waiting, "live")).toBe(true);
    expect(marksIn(rejected, "live")).toBe(false);
    expect(marksIn(rejected, "both")).toBe(true);
    expect(marksIn(undefined, "both")).toBe(false);
  });
});

describe("which marks a record and its values get", () => {
  const changedName = {
    action: "changed" as const,
    state: "waiting" as const,
    changed: ["name"],
  };

  it("leaves a record's slot empty when its draft changes only values the row shows", () => {
    expect(recordMark(changedName, new Set(["name"]))).toBeUndefined();
    expect(recordMark(changedName, new Set(["description"]))).toBe(changedName);
    expect(
      recordMark({ ...changedName, action: "created" }, new Set(["name"])),
    ).toBeDefined();
  });

  it("marks a value its record's draft changes, without the record's own kind", () => {
    expect(changedValue(changedName, "name")).toEqual({
      action: "changed",
      state: "waiting",
      reason: undefined,
      unpublished: undefined,
    });
    expect(changedValue(changedName, "description")).toBeUndefined();
    expect(changedValue(undefined, "name")).toBeUndefined();
  });

  it("marks a record's parts as waiting while any waits, and rejected only once all were", () => {
    expect(partsMark([undefined, rejected, waiting])).toEqual({
      action: "changed",
      state: "waiting",
    });
    expect(partsMark([rejected])).toEqual({
      action: "changed",
      state: "rejected",
    });
    expect(draftWords(partsMark([rejected]) ?? waiting)).toBe("Rejected");
    expect(partsMark([rejected], true)).toBeUndefined();
    expect(partsMark([undefined])).toBeUndefined();
  });
});

describe("a draft's mark on screen", () => {
  it("reads a draft's words after the item beside live", () => {
    renderIn(
      "both",
      <DraftedItem draft={{ action: "created", state: "waiting" }}>
        Fictional Name
      </DraftedItem>,
    );
    expect(screen.getByText(", Draft: added")).toBeDefined();
  });

  it("puts a waiting draft's kind in a box, but never a rejected one's", () => {
    renderIn(
      "both",
      <>
        <DraftedItem draft={{ ...waiting, moved: true }}>Moved one</DraftedItem>
        <DraftedItem draft={{ ...rejected, moved: true }}>
          Rejected one
        </DraftedItem>
      </>,
    );
    expect(screen.getAllByText("Moved")).toHaveLength(1);
  });

  it("says when a shown draft takes effect, but not live only", () => {
    const item = (
      <DraftedItem draft={waiting} from="Dec 1, 2026">
        Fictional Name
      </DraftedItem>
    );
    const { unmount } = renderIn("both", item);
    expect(screen.getByText("from Dec 1, 2026")).toBeDefined();
    unmount();
    renderIn("live", item);
    expect(screen.queryByText("from Dec 1, 2026")).toBeNull();
  });

  it("adds a hollow dot for a rejected draft's unpublished changes, since a red dot can't be hollow", () => {
    renderIn(
      "both",
      <DraftedItem draft={{ ...rejected, unpublished: true }}>
        Fictional Name
      </DraftedItem>,
    );
    expect(
      screen.getAllByText("", { selector: '[aria-hidden="true"]' }),
    ).toHaveLength(2);
    expect(
      screen.getByText(", Rejected, unpublished: Fictional reason."),
    ).toBeDefined();
  });

  it("marks a waiting draft Live, naming what waits, live only", () => {
    renderIn(
      "live",
      <DraftedItem draft={{ action: "deleted", state: "waiting" }}>
        Fictional Name
      </DraftedItem>,
    );
    expect(
      screen.getByText(", Live. Its removal is waiting for approval."),
    ).toBeDefined();
    expect(screen.queryByText(/Draft/)).toBeNull();
  });

  it("marks nothing for a rejected draft live only, but keeps the lock", () => {
    renderIn(
      "live",
      <DraftedItem draft={rejected} heldBy="Fictional Holder">
        Fictional Name
      </DraftedItem>,
    );
    expect(
      screen.getByText(", being changed by Fictional Holder"),
    ).toBeDefined();
    expect(screen.queryByText(/Rejected|Live/)).toBeNull();
  });

  it("marks the user's own unpublished changes where no draft says so, except live only", () => {
    const item = <DraftedItem unpublished>Fictional Name</DraftedItem>;
    const { unmount } = renderIn("both", item);
    expect(screen.getByText(", Unpublished")).toBeDefined();
    unmount();
    renderIn("live", item);
    expect(screen.queryByText(/Unpublished/)).toBeNull();
  });

  it("reads a part's change in place of the draft's words", () => {
    renderIn(
      "both",
      <DraftedPartItem draft={waiting} part="added">
        Fictional Member
      </DraftedPartItem>,
    );
    expect(screen.getByText(", added")).toBeDefined();
    expect(screen.queryByText(/Draft/)).toBeNull();
  });

  it("says a part's draft was rejected, after what it does", () => {
    renderIn(
      "both",
      <DraftedPartItem draft={rejected} part="removed">
        Fictional Member
      </DraftedPartItem>,
    );
    expect(screen.getByText(", removed")).toBeDefined();
    expect(screen.getByText(", rejected")).toBeDefined();
  });

  it("strikes through a part a shown draft takes away, but not live only", () => {
    const item = (
      <DraftedPartItem draft={waiting} part="removed">
        Fictional Member
      </DraftedPartItem>
    );
    const { unmount } = renderIn("both", item);
    expect(screen.getByText("Fictional Member").className).not.toBe("");
    unmount();
    renderIn("live", item);
    expect(screen.getByText("Fictional Member").className).toBe("");
  });

  it.each([
    ["removed", "Live. Its removal is waiting for approval."],
    ["changed", "Live. A change is waiting for approval."],
  ] as const)(
    "names the change waiting for a part as it is live, live only: %s",
    (part, words) => {
      renderIn(
        "live",
        <DraftedPartItem draft={waiting} part={part} live>
          Fictional Member
        </DraftedPartItem>,
      );
      expect(screen.getByText(`, ${words}`)).toBeDefined();
    },
  );

  it("marks a part as it is live in a Live row, unstruck", () => {
    renderIn(
      "both",
      <DraftedPartItem draft={waiting} part="removed" live>
        Fictional Member
      </DraftedPartItem>,
    );
    expect(screen.getByText(", live")).toBeDefined();
    expect(screen.queryByText(", removed")).toBeNull();
  });

  it("gives a part as it is live no mark without a draft", () => {
    renderIn(
      "both",
      <DraftedPartItem draft={undefined} part={undefined} live>
        Fictional Member
      </DraftedPartItem>,
    );
    expect(screen.queryByText(", live")).toBeNull();
  });
});

describe("a row's values", () => {
  const filled = {
    action: "changed" as const,
    state: "waiting" as const,
    changed: ["description"],
    live: { description: "" },
  };

  it("marks a changed value, with words for none where the draft empties it", () => {
    renderIn(
      "both",
      <DraftedValue
        draft={filled}
        fields={["description"]}
        emptied="Description"
      >
        {""}
      </DraftedValue>,
    );
    expect(screen.getByText("No description")).toBeDefined();
    expect(screen.getByText(", Draft")).toBeDefined();
  });

  it("says what a value was, from its draft's live value, only where the draft changes it", () => {
    const renamed = {
      action: "changed" as const,
      state: "waiting" as const,
      changed: ["name"],
      live: { name: "Fictional Before" },
    };
    const { unmount } = renderIn(
      "both",
      <DraftedValue draft={renamed} fields={["name"]} named="Name">
        Fictional After
      </DraftedValue>,
    );
    expect(
      screen.getByText(", Draft: changed from “Fictional Before”"),
    ).toBeDefined();
    unmount();
    renderIn(
      "both",
      <DraftedValue
        draft={{ ...renamed, changed: ["name", "colour"], live: {} }}
        fields={["name", "colour"]}
        named="Name"
      >
        Fictional After
      </DraftedValue>,
    );
    expect(screen.getByText(", Draft: changed from no name")).toBeDefined();
  });

  it("shows a value its draft keeps as it is, unmarked", () => {
    renderIn(
      "both",
      <DraftedValue draft={filled} fields={["name"]}>
        Fictional Name
      </DraftedValue>,
    );
    expect(screen.getByText("Fictional Name")).toBeDefined();
    expect(screen.queryByText(/Draft/)).toBeNull();
  });

  it("marks a live value under a changed one Live, with words for none", () => {
    renderIn(
      "both",
      <LiveValue draft={filled} fields={["description"]} emptied="Description">
        {""}
      </LiveValue>,
    );
    expect(screen.getByText("No description")).toBeDefined();
    expect(screen.getByText(", live")).toBeDefined();
  });

  it("puts a record's own mark first in its row, and Live's in its Live row", () => {
    renderIn(
      "both",
      <>
        <RowMarks mark={{ action: "created", state: "waiting" }}>
          Fictional Name
        </RowMarks>
        <LiveRowMarks marked>Live Name</LiveRowMarks>
        <LiveRowMarks marked={false}>Plain Name</LiveRowMarks>
      </>,
    );
    expect(screen.getByText(", Draft: added")).toBeDefined();
    expect(screen.getAllByText(", live")).toHaveLength(1);
  });
});

describe("a class's mark", () => {
  it("names a class beyond General, and takes a symbol's room, not its words'", () => {
    expect(classWords("confidential")).toEqual(["Confidential"]);
    expect(classWords("general")).toEqual([]);
    expect(classWords(undefined)).toEqual([]);
    expect(classMarkChars("personal")).toBeLessThan("Personal".length);
    expect(classMarkChars("personal")).toBeGreaterThan(0);
    expect(classMarkChars("general")).toBe(0);
  });
});

describe("a warning", () => {
  // Read from a wrapper of its own, since the rendered page also holds Mantine's styles.
  const warning = (props: { empty?: boolean; children?: ReactNode }) => {
    renderIn(
      "both",
      <span data-testid="marked">
        <MarkedItem
          tone="warning"
          words="Fictional warning"
          spoken="fictional reason"
          {...props}
        />
      </span>,
    );
    return screen.getByTestId("marked").textContent;
  };
  const box = () =>
    screen.getByText("Fictional warning").closest('[class*="warningKind"]');

  it("follows a value in a red box, read aloud with why", () => {
    expect(warning({ children: "Fictional value" })).toBe(
      "Fictional valueFictional warning, fictional reason",
    );
    expect(box()).not.toBeNull();
  });

  it.each([
    ["an empty value", { empty: true, children: "" }],
    ["no value at all", {}],
  ])(
    "stands in %s's place as red words, with no box, read aloud the same",
    (_case, props) => {
      expect(warning(props)).toBe("Fictional warning, fictional reason");
      expect(box()).toBeNull();
      expect(screen.getByText("Fictional warning").className).toContain(
        "warningWords",
      );
    },
  );
});
