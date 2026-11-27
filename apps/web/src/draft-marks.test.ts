// SPDX-License-Identifier: Apache-2.0

// Tests of which draft marks a record, its values and its parts, and the words its dot stands for.

import { describe, expect, it } from "vitest";
import {
  changedValue,
  draftTip,
  draftWords,
  emptiedWords,
  liveWaitingWords,
  noneInSentence,
  partsMark,
  recordMark,
  wasWords,
} from "./draft-marks.ts";
import {
  rejectedDraft as rejected,
  waitingDraft as waiting,
} from "./test-support.tsx";

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

  it("says a value that was empty is filled in, rather than changed from none", () => {
    expect(draftTip(waiting, { was: null, by: "Fictional Person" })).toBe(
      "Draft: filled in, by Fictional Person",
    );
    expect(draftTip(rejected, { was: null })).toBe(
      "Rejected, filled in: Fictional reason.",
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

  it("quotes what a value was, cut short when long, or none when it was empty", () => {
    expect(wasWords("Level")).toBe("“Level”");
    expect(wasWords("")).toBeNull();
    expect(wasWords("x".repeat(50))).toBe(`“${"x".repeat(39)}…”`);
    expect(noneInSentence("Description")).toBe("no description");
    expect(noneInSentence("Start", "Later")).toBe("later");
    expect(emptiedWords("ID")).toBe("No ID");
    expect(emptiedWords("Start")).toBe("No start");
    expect(emptiedWords("Needed by")).toBe("No needed by");
    expect(emptiedWords("Proposal ID")).toBe("No proposal ID");
    expect(noneInSentence("Fictional Score")).toBe("no Fictional Score");
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
