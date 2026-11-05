// SPDX-License-Identifier: Apache-2.0

// Tests for the plain-English descriptions of permissions, shown when roles are set.

import { describe, expect, it } from "vitest";
import { permissionDescriptions, permissionSchema } from "./access.ts";

describe("permissionDescriptions", () => {
  it.each(permissionSchema.options)(
    "says in a sentence what %s allows, and what a user without it cannot do",
    (permission) => {
      // The permission is always one of the shared list.
      // eslint-disable-next-line security/detect-object-injection
      const { allows, without, needs } = permissionDescriptions[permission];
      for (const sentence of [allows, without]) {
        expect(sentence).toMatch(/^[A-Z].*\.$/u);
      }
      expect(allows).not.toBe(without);
      expect(needs).not.toBe(permission);
    },
  );
});
