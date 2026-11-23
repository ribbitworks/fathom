// SPDX-License-Identifier: Apache-2.0

// The Features Board's width in tests, which the simulated browser can't measure, and Mantine's
// hooks giving it. It imports none of the app, so a mock built from it imports nothing it mocks.

// The board's width, which the simulated browser can't measure, changed by the tests.
export const size = {
  width: 1000,
  set: (width: number) => {
    size.width = width;
  },
};

// Semgrep can't parse typeof import() as a type argument.
type Hooks = typeof import("@mantine/hooks");

// Mantine's hooks with the board's width as the tests set it.
export async function withBoardWidth(actual: Hooks): Promise<Hooks> {
  const { useState } = await import("react");
  return {
    ...actual,
    useElementSize: () => {
      const [width, setWidth] = useState(size.width);
      size.set = setWidth;
      return { ref: () => undefined, width, height: 0 };
    },
  };
}
