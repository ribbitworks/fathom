// SPDX-License-Identifier: Apache-2.0

// Tests for how a project's owner, live and drafted, reads to a reader who can't see some people.

import type { Project } from "@fathom/shared";
import { describe, expect, it } from "vitest";
import { ownerShown } from "./project-reads.ts";

const hidden = new Set(["p-hidden"]);

const project = (
  ownerId: string | null,
  draft?: {
    action?: "changed" | "created" | "deleted";
    changed: string[];
    live: object;
    by?: boolean;
  },
) =>
  ({
    id: "project",
    ownerId,
    ...(draft === undefined
      ? {}
      : {
          draft: {
            action: draft.action ?? "changed",
            changed: draft.changed,
            live: draft.live,
            ...(draft.by === false
              ? {}
              : {
                  changedBy: Object.fromEntries(
                    draft.changed.map((field) => [field, "u-maker"]),
                  ),
                }),
          },
        }),
  }) as unknown as Project;

describe("an owner a reader can't see", () => {
  it("reads as none, live", () => {
    expect(ownerShown(project("p-hidden"), hidden).ownerId).toBeNull();
    expect(ownerShown(project("p-seen"), hidden).ownerId).toBe("p-seen");
  });

  it("makes a draft that only gives them the project no draft", () => {
    const shown = ownerShown(
      project("p-hidden", { changed: ["ownerId"], live: { ownerId: null } }),
      hidden,
    );
    expect(shown.ownerId).toBeNull();
    expect(shown.draft).toBeUndefined();
  });

  it("leaves a draft's other changes, without the owner", () => {
    const shown = ownerShown(
      project("p-hidden", {
        changed: ["ownerId", "name"],
        live: { ownerId: null, name: "Before" },
      }),
      hidden,
    );
    expect(shown.draft?.changed).toEqual(["name"]);
    expect(shown.draft?.live).toEqual({ name: "Before" });
    expect(shown.draft?.changedBy).toEqual({ name: "u-maker" });
  });

  it("shows a change from them to someone the reader sees as from none", () => {
    const shown = ownerShown(
      project("p-seen", {
        changed: ["ownerId"],
        live: { ownerId: "p-hidden" },
      }),
      hidden,
    );
    expect(shown.ownerId).toBe("p-seen");
    expect(shown.draft?.live).toEqual({ ownerId: null });
  });

  it("names no owner of a new project drafted with them, nor says one was set", () => {
    const shown = ownerShown(
      project("p-hidden", {
        action: "created",
        changed: ["name", "ownerId"],
        live: {},
      }),
      hidden,
    );
    expect(shown.ownerId).toBeNull();
    expect(shown.draft?.action).toBe("created");
    expect(shown.draft?.changed).toEqual(["name"]);
    expect(shown.draft?.changedBy).toEqual({ name: "u-maker" });
  });

  it("keeps a new project drafted with someone the reader sees, with no live owner", () => {
    const shown = ownerShown(
      project("p-seen", { action: "created", changed: ["ownerId"], live: {} }),
      hidden,
    );
    expect(shown.ownerId).toBe("p-seen");
    expect(shown.draft?.live).toEqual({});
  });

  it("sends no id of theirs in a draft removing the project", () => {
    const shown = ownerShown(
      project(null, {
        action: "deleted",
        changed: ["ownerId"],
        live: { ownerId: "p-hidden" },
        by: false,
      }),
      hidden,
    );
    expect(shown.draft?.action).toBe("deleted");
    expect(JSON.stringify(shown)).not.toContain("p-hidden");
  });
});
