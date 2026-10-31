// SPDX-License-Identifier: Apache-2.0

// Fathom's mark and name: three layers of water, fading as they go deeper, in a rounded square. The
// name is white on the dark sidebar, and the page's own text colour elsewhere.

import { Group, Text, VisuallyHidden } from "@mantine/core";
import classes from "./brand.module.css";

const layers = [
  { y: 8.5, opacity: 1 },
  { y: 12.5, opacity: 0.7 },
  { y: 16.5, opacity: 0.4 },
];

// The sidebar's size, or a larger one for the sign-in page.
const sidebarSize = { mark: 26, name: 17, gap: 10 };
const largeSize = { mark: 44, name: 32, gap: 14 };

export function Brand({
  onDark = false,
  size = "sidebar",
  markOnly = false,
}: {
  onDark?: boolean;
  size?: "sidebar" | "large";
  // The mark alone, as in the collapsed sidebar, with the name only for screen readers.
  markOnly?: boolean;
}) {
  const { mark, name, gap } = size === "large" ? largeSize : sidebarSize;
  return (
    <Group gap={gap} wrap="nowrap">
      <svg width={mark} height={mark} viewBox="0 0 24 24" aria-hidden="true">
        <rect width="24" height="24" rx="6" className={classes.mark} />
        {layers.map(({ y, opacity }) => (
          <path
            key={y}
            d={`M5 ${String(y)}c2.3-1.6 4.7-1.6 7 0s4.7 1.6 7 0`}
            fill="none"
            className={classes.waves}
            strokeWidth="1.8"
            strokeLinecap="round"
            opacity={opacity}
          />
        ))}
      </svg>
      {markOnly ? (
        <VisuallyHidden>Fathom</VisuallyHidden>
      ) : (
        <Text
          className={onDark ? classes.nameOnDark : undefined}
          fw={600}
          fz={name}
        >
          Fathom
        </Text>
      )}
    </Group>
  );
}
