// SPDX-License-Identifier: Apache-2.0

// Which of a user's private changes a give-up takes back, from facts the history read gives. Pure.

// A user's private change still in an open change set, as a give-up may take it back.
export interface HeldCandidate {
  // When its change set was made, and when the user began their private change to the record, null
  // when they hold none, in microseconds.
  madeAtMicros: number;
  sinceMicros: number | null;
  // Whether a change given up names it already.
  takenBack: boolean;
  // Whether an undo undid its change set, and whether its change set is an undo of a private one.
  undone: boolean;
  undoesPrivate: boolean;
}

// Whether a give-up takes back a user's private change: one they still hold, made since they last
// took the record back by hand, not taken back already, and not cancelled by an undo of its private
// change set, nor that undo itself. An undo of a change set already published stands, so is taken
// back.
export const givenUpWith = (change: HeldCandidate): boolean =>
  change.sinceMicros !== null &&
  change.madeAtMicros >= change.sinceMicros &&
  !change.takenBack &&
  !change.undone &&
  !change.undoesPrivate;
