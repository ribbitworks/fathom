// SPDX-License-Identifier: Apache-2.0

// Whether a password a person chose is too common or easy to guess, by zxcvbn's estimate, with its
// common password, word, and name lists and keyboard patterns, and the owner's own name and email
// address. Kept out of the package's main entry, since its dictionaries are large: the server loads
// them once, when it starts, and the browser only when a form for a new password opens.

import { ZxcvbnFactory } from "@zxcvbn-ts/core";
import {
  adjacencyGraphs,
  dictionary as commonDictionary,
} from "@zxcvbn-ts/language-common";
import { dictionary as englishDictionary } from "@zxcvbn-ts/language-en";
import {
  type GuessableCheck,
  ownerWords,
  type PasswordOwner,
  safeGuessScore,
} from "./passwords.ts";

const estimator = new ZxcvbnFactory({
  graphs: adjacencyGraphs,
  dictionary: { ...commonDictionary, ...englishDictionary },
});

// From 0, guessed at once, to 4, very hard to guess.
export const guessScore = (password: string, owner: PasswordOwner): number =>
  estimator.check(password, ownerWords(owner)).score;

export const isGuessable: GuessableCheck = (password, owner) =>
  guessScore(password, owner) < safeGuessScore;
