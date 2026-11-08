// SPDX-License-Identifier: Apache-2.0

// Tests for how an access history entry names the roles it involves.

import { defaultPasswordSettings, type HistoryEntry } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { describeAction, describeDetails, subjectName } from "./history.ts";

const entry = (
  action: string,
  details: HistoryEntry["details"],
): HistoryEntry => ({
  id: 1,
  occurredAt: "2026-11-06T12:00:00.000Z",
  actor: null,
  action,
  subject: { id: "user-2", name: "Fictional Planner" },
  details,
});

describe("describeDetails", () => {
  it("names the role an account was given, and the one it held before", () => {
    expect(
      describeDetails(
        entry("roles-changed", { role: "Planner", previousRole: "Executive" }),
      ),
    ).toBe("from Executive to Planner");
  });

  it("names only the role given to an account that held none", () => {
    expect(describeDetails(entry("roles-changed", { role: "Planner" }))).toBe(
      "to Planner",
    );
  });

  it("names the role a session started as, naming its account only once", () => {
    const signedIn = entry("signed-in", { role: "Project Manager" });
    expect(describeAction("signed-in")).toEqual({
      verb: "signed in",
      caution: false,
    });
    expect(describeDetails(signedIn)).toBe("as Project Manager");
    expect(subjectName(signedIn)).toBeNull();
    expect(describeDetails(entry("signed-in", {}))).toBe("");
  });

  it("names the role switched from and to, naming its account only once", () => {
    const switched = entry("role-switched", {
      role: "Engineering Manager",
      previousRole: "Feature Lead",
    });
    expect(describeAction("role-switched")).toEqual({
      verb: "switched role",
      caution: false,
    });
    expect(describeDetails(switched)).toBe(
      "from Feature Lead to Engineering Manager",
    );
    expect(subjectName(switched)).toBeNull();
  });

  it("names every role an account holds, the default first and marked, before and after", () => {
    expect(
      describeDetails(
        entry("roles-changed", {
          role: "Planner",
          roles: ["Executive", "Planner"],
          previousRole: "Executive",
          previousRoles: ["Executive"],
        }),
      ),
    ).toBe("from Executive to Planner (default), Executive");
    expect(
      describeDetails(
        entry("account-created", {
          role: "Planner",
          roles: ["Planner", "Executive"],
        }),
      ),
    ).toBe("with Planner (default), Executive");
    expect(
      describeDetails(entry("roles-changed", { role: "Planner", roles: [] })),
    ).toBe("to Planner");
  });

  it("names nothing for an entry with no roles or time zones", () => {
    expect(describeDetails(entry("password-reset", {}))).toBe("");
  });

  it("names each password setting changed, before and after", () => {
    const { rules, recipe } = defaultPasswordSettings;
    expect(
      describeDetails(
        entry("password-settings-changed", {
          passwords: {
            rules: { ...rules, minimumLength: 14, symbols: true },
            recipe: {
              ...recipe,
              length: 24,
              symbols: true,
              digits: false,
              avoidLookAlikes: false,
            },
          },
          previousPasswords: defaultPasswordSettings,
        }),
      ),
    ).toBe(
      "password requirements need 14 characters, not 12; password requirements need a symbol; generated passwords have 24 characters, not 20; generated passwords no longer use digits; generated passwords use symbols; generated passwords may use characters that look alike",
    );
  });

  it("names rules and recipes loosened", () => {
    const strict = {
      rules: { ...defaultPasswordSettings.rules, uppercase: true },
      recipe: { ...defaultPasswordSettings.recipe, avoidLookAlikes: false },
    };
    expect(
      describeDetails(
        entry("password-settings-changed", {
          passwords: defaultPasswordSettings,
          previousPasswords: strict,
        }),
      ),
    ).toBe(
      "password requirements no longer need an uppercase letter; generated passwords leave out characters that look alike",
    );
  });

  it("names nothing for password settings unchanged, or without those before", () => {
    expect(
      describeDetails(
        entry("password-settings-changed", {
          passwords: defaultPasswordSettings,
          previousPasswords: defaultPasswordSettings,
        }),
      ),
    ).toBe("");
    expect(
      describeDetails(
        entry("password-settings-changed", {
          passwords: defaultPasswordSettings,
        }),
      ),
    ).toBe("");
  });

  it("marks a change to the password settings as worth checking", () => {
    expect(describeAction("password-settings-changed")).toEqual({
      verb: "changed Fathom's password settings",
      caution: true,
    });
  });
});
