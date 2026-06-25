import { useEffect, useState } from "react";
import { generateSteamGuardCode, secondsRemaining, CODE_PERIOD } from "../lib/steamGuard";
import { useStore } from "../store/useStore";

export interface CodeState {
  code: string;
  remaining: number;
}

/**
 * Generates live Steam Guard codes for every account. Codes are recomputed when
 * the 30s window rolls over; the countdown ticks every second. Pure client-side.
 */
export function useSteamCodes(): Record<string, CodeState> {
  const accounts = useStore((s) => s.accounts);
  const [codes, setCodes] = useState<Record<string, CodeState>>({});
  const [remaining, setRemaining] = useState(() => secondsRemaining());

  // Recompute codes whenever the time window changes or the account list changes.
  useEffect(() => {
    let cancelled = false;

    async function compute() {
      const now = Date.now() / 1000;
      const entries = await Promise.all(
        accounts.map(async (a) => {
          try {
            const code = await generateSteamGuardCode(a.sharedSecret, now);
            return [a.id, code] as const;
          } catch {
            return [a.id, "ERROR"] as const;
          }
        }),
      );
      if (cancelled) return;
      const rem = secondsRemaining();
      setCodes(Object.fromEntries(entries.map(([id, code]) => [id, { code, remaining: rem }])));
    }

    void compute();

    // Align recompute to the next window boundary, then every CODE_PERIOD.
    const msToBoundary = secondsRemaining() * 1000;
    let interval: ReturnType<typeof setInterval> | undefined;
    const timeout = setTimeout(() => {
      void compute();
      interval = setInterval(() => void compute(), CODE_PERIOD * 1000);
    }, msToBoundary + 50);

    return () => {
      cancelled = true;
      clearTimeout(timeout);
      if (interval) clearInterval(interval);
    };
  }, [accounts]);

  // 1s countdown tick.
  useEffect(() => {
    const t = setInterval(() => setRemaining(secondsRemaining()), 250);
    return () => clearInterval(t);
  }, []);

  // Merge the live countdown into each code entry.
  const merged: Record<string, CodeState> = {};
  for (const id of Object.keys(codes)) merged[id] = { code: codes[id].code, remaining };
  return merged;
}
