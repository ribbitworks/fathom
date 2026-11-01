// SPDX-License-Identifier: Apache-2.0

// Signing out after a time without use, as the server does. A key, click, touch, scroll, or mouse
// movement in any of the user's Fathom tabs counts as use, and while there is use the server's
// session is kept alive too, so it does not end while the user is working without saving.

import { sessionIdleMinutes } from "@fathom/shared";
import { useEffect, useEffectEvent } from "react";

const lastUseKey = "fathom-last-use";
const second = 1000;
const minute = 60 * second;
const idleFor = sessionIdleMinutes * minute;
// The server pushes a session's expiry back at most once a minute, so telling it more often
// gains nothing.
const keepAliveEvery = minute;
const checkEvery = 15 * second;
// Mouse movements come many times a second, so use is recorded at most this often.
const recordEvery = 5 * second;
const useEvents = [
  "keydown",
  "pointerdown",
  "pointermove",
  "wheel",
  "touchstart",
] as const;

// Without browser storage, or with something else in it, each tab goes by its own use alone.
function sharedLastUse(): number {
  try {
    const value = Number(localStorage.getItem(lastUseKey));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

function shareLastUse(time: number) {
  try {
    localStorage.setItem(lastUseKey, String(time));
  } catch {
    // This tab still goes by its own use.
  }
}

export function useSignOutWhenIdle({
  onIdle,
  keepAlive,
}: {
  onIdle: () => void;
  keepAlive: () => void;
}) {
  const idle = useEffectEvent(onIdle);
  const alive = useEffectEvent(keepAlive);
  useEffect(() => {
    // Opening a page is use, and the server has just been asked for the session.
    let recorded = Date.now();
    let keptAlive = recorded;
    shareLastUse(recorded);
    let ended = false;

    const check = () => {
      if (
        !ended &&
        Date.now() - Math.max(recorded, sharedLastUse()) >= idleFor
      ) {
        ended = true;
        idle();
      }
    };
    // Use that comes after the time is up, such as on waking from sleep before any check, signs
    // out rather than starting the time again.
    const used = () => {
      const now = Date.now();
      if (now - recorded >= recordEvery) {
        check();
        if (ended) return;
        recorded = now;
        shareLastUse(now);
      }
      if (now - keptAlive >= keepAliveEvery) {
        keptAlive = now;
        alive();
      }
    };

    for (const event of useEvents) {
      window.addEventListener(event, used, { passive: true });
    }
    // A tab in the background, or a computer waking from sleep, checks as soon as it is seen.
    document.addEventListener("visibilitychange", check);
    const timer = setInterval(check, checkEvery);
    return () => {
      for (const event of useEvents) window.removeEventListener(event, used);
      document.removeEventListener("visibilitychange", check);
      clearInterval(timer);
    };
  }, []);
}
