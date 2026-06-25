import { useEffect } from "react";
import { useStore } from "../store/useStore";

/** Locks the encrypted vault after a period of inactivity. */
export function useAutoLock() {
  const minutes = useStore((s) => s.settings.autoLockMinutes);
  const encryption = useStore((s) => s.settings.encryptionEnabled);
  const lock = useStore((s) => s.lock);

  useEffect(() => {
    if (!encryption || minutes <= 0) return;
    let timer: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(lock, minutes * 60 * 1000);
    };
    const events = ["mousedown", "keydown", "touchstart", "visibilitychange"];
    events.forEach((e) => window.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [minutes, encryption, lock]);
}
