import { useEffect, useState } from "react";
import { useStore } from "../store/useStore";

/**
 * Drives the per-second countdown for Steam Guard codes. All accounts share the
 * same 30s window, so we track one remaining value and refetch codes from the
 * backend when the window rolls over.
 */
export function useCodeTicker(): number {
  const accounts = useStore((s) => s.accounts);
  const codesFetchedAt = useStore((s) => s.codesFetchedAt);
  const refreshCodes = useStore((s) => s.refreshCodes);
  const [remaining, setRemaining] = useState(30);

  useEffect(() => {
    const base = accounts.find((a) => a.codeExpiresIn !== undefined);
    const baseRemaining = base?.codeExpiresIn ?? 30;

    const tick = () => {
      const elapsed = (Date.now() - codesFetchedAt) / 1000;
      const rem = Math.max(0, Math.ceil(baseRemaining - elapsed));
      setRemaining(rem);
      if (rem <= 0) void refreshCodes();
    };
    tick();
    const t = setInterval(tick, 500);
    return () => clearInterval(t);
  }, [accounts, codesFetchedAt, refreshCodes]);

  return remaining;
}
