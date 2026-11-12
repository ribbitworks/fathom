// SPDX-License-Identifier: Apache-2.0

// One tooltip for a whole table, giving the tip of whatever the pointer is over, or of the first
// thing offering one in the cell with keyboard focus, since a tooltip for each of thousands of cells
// would slow a large table down. Anything in the table offers a tip by carrying it in the attribute
// named here. Outside such a table, a tip is a tooltip of its own.

import { Tooltip } from "@mantine/core";
import {
  createContext,
  type FocusEvent,
  type MouseEvent,
  type ReactNode,
  useContext,
  useState,
} from "react";
import styles from "./table-tips.module.css";

export const tipAttribute = "data-tip";

// Whether what is drawn is inside a table whose one tooltip gives its tips.
const InTableTips = createContext(false);

const withTip = `[${tipAttribute}]`;

export function TableTips({ children }: { children: ReactNode }) {
  const [tip, setTip] = useState<{ element: HTMLElement; text: string }>();
  const showTipOf = (element: HTMLElement | null) => {
    setTip((current) =>
      element === null
        ? undefined
        : current?.element === element
          ? current
          : { element, text: element.getAttribute(tipAttribute) as string },
    );
  };
  const hideTip = () => {
    setTip(undefined);
  };
  return (
    <div
      className={styles.tips}
      onMouseOver={(event: MouseEvent<HTMLElement>) => {
        showTipOf((event.target as HTMLElement).closest<HTMLElement>(withTip));
      }}
      onMouseLeave={hideTip}
      onFocus={(event: FocusEvent<HTMLElement>) => {
        showTipOf(
          event.target.closest<HTMLElement>(withTip) ??
            event.target.querySelector<HTMLElement>(withTip),
        );
      }}
      onBlur={hideTip}
    >
      {tip !== undefined && (
        <Tooltip
          opened
          label={tip.text}
          target={tip.element}
          className={styles.tip}
        />
      )}
      <InTableTips value>{children}</InTableTips>
    </div>
  );
}

// Something small offering a tip, such as a draft's dot: through the table's one tooltip inside a
// table, and otherwise its own tooltip.
export function Tipped({
  tip,
  className,
  children,
}: {
  tip: string;
  // The tipped element's own classes, so it needs no wrapper of its own, which in a row of boxes
  // would add a line's height.
  className?: string | undefined;
  children: ReactNode;
}) {
  const inTable = useContext(InTableTips);
  return inTable ? (
    <span className={className} {...{ [tipAttribute]: tip }}>
      {children}
    </span>
  ) : (
    <Tooltip label={tip} withinPortal>
      <span className={className}>{children}</span>
    </Tooltip>
  );
}
