// SPDX-License-Identifier: Apache-2.0

// The Features Board's width in tests, which the simulated browser can't measure, and Mantine's
// hooks giving it. It imports none of the app, so a mock built from it imports nothing it mocks.

const setters = new Set<(width: number) => void>();

// The board's width, which the simulated browser can't measure, changed by the tests for every
// element measured, the board and its grid alike.
export const size = {
  width: 1000,
  set: (width: number) => {
    size.width = width;
    for (const setWidth of setters) setWidth(width);
  },
};

// Semgrep can't parse typeof import() as a type argument.
type Hooks = typeof import("@mantine/hooks");

// Mantine's hooks with the board's width as the tests set it.
export async function withBoardWidth(actual: Hooks): Promise<Hooks> {
  const { useEffect, useState } = await import("react");
  return {
    ...actual,
    useElementSize: () => {
      const [width, setWidth] = useState(size.width);
      useEffect(() => {
        setters.add(setWidth);
        return () => {
          setters.delete(setWidth);
        };
      }, []);
      return { ref: () => undefined, width, height: 0 };
    },
  };
}
